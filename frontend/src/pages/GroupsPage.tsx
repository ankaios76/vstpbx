import { useEffect, useMemo, useState } from 'react'
import { Plus, Edit2, Trash2, Users } from 'lucide-react'
import { api } from '../services/api'
import { useI18n } from '../context/I18nContext'

interface RingGroup {
  id: number
  name: string
  extension: string
  inbound_trunk_id: number | null
  inbound_did: string | null
  strategy: string
  ring_time: number
  enabled: boolean
  members: string[]
  created_at: string
  updated_at: string
}

interface SIPPeer {
  id: number
  extension: string
  caller_id: string | null
  enabled: boolean
}

interface AvailableDidGroup {
  trunk_id: number
  trunk_name: string
  dids: string[]
}

export default function GroupsPage() {
  const { t } = useI18n()
  const STRATEGIES = [
    { value: 'ringall', label: t('groups.all.at.once') },
    { value: 'roundrobin', label: t('groups.round.robin') },
    { value: 'leastrecent', label: t('groups.least.recently.used') },
  ]
  const [groups, setGroups] = useState<RingGroup[]>([])
  const [peers, setPeers] = useState<SIPPeer[]>([])
  const [availableDids, setAvailableDids] = useState<AvailableDidGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<RingGroup | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    extension: '',
    inbound_trunk_id: null as number | null,
    inbound_did: '',
    strategy: 'ringall',
    ring_time: 20,
    enabled: true,
    members: [] as string[],
  })

  const memberOptions = useMemo(() => {
    return [...peers]
      .filter(p => p.enabled)
      .sort((a, b) => a.extension.localeCompare(b.extension))
  }, [peers])

  const availableExtensions = useMemo(() => {
    const used = new Set<string>()
    peers.forEach(p => used.add(p.extension))
    groups.forEach(g => used.add(g.extension))

    const list: string[] = []
    for (let i = 1000; i <= 1999; i++) {
      const ext = String(i)
      if (!used.has(ext)) list.push(ext)
    }

    if (editing && editing.extension && !list.includes(editing.extension)) {
      list.unshift(editing.extension)
    }

    return list
  }, [peers, groups, editing])

  const fetchAll = async () => {
    try {
      const [groupData, peerData, didData] = await Promise.all([
        api.getRingGroups(),
        api.getSipPeers(),
        api.getAvailableDids(),
      ])
      setGroups(groupData)
      setPeers(peerData)
      setAvailableDids(didData)
    } catch (e: any) {
      setError(e.message || t('groups.data.could.not.be.loaded'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({
      name: '',
      extension: '',
      inbound_trunk_id: null,
      inbound_did: '',
      strategy: 'ringall',
      ring_time: 20,
      enabled: true,
      members: [],
    })
    setError('')
    setShowForm(true)
  }

  const openEdit = (group: RingGroup) => {
    setEditing(group)
    setForm({
      name: group.name,
      extension: group.extension,
      inbound_trunk_id: group.inbound_trunk_id || null,
      inbound_did: group.inbound_did || '',
      strategy: group.strategy,
      ring_time: group.ring_time || 20,
      enabled: group.enabled,
      members: group.members || [],
    })
    setError('')
    setShowForm(true)
  }

  const toggleMember = (ext: string) => {
    setForm(prev => {
      const exists = prev.members.includes(ext)
      return {
        ...prev,
        members: exists ? prev.members.filter(m => m !== ext) : [...prev.members, ext],
      }
    })
  }

  const trunkOptions = useMemo(() => {
    const options = [...availableDids]
    if (editing && editing.inbound_trunk_id) {
      const exists = options.find(t => t.trunk_id === editing.inbound_trunk_id)
      if (!exists) {
        options.unshift({
          trunk_id: editing.inbound_trunk_id,
          trunk_name: t('groups.trunkFallback', { id: editing.inbound_trunk_id }),
          dids: editing.inbound_did ? [editing.inbound_did] : [],
        })
      }
    }
    return options
  }, [availableDids, editing])

  const didOptions = useMemo(() => {
    if (!form.inbound_trunk_id) return []
    const trunk = trunkOptions.find(t => t.trunk_id === form.inbound_trunk_id)
    const dids = trunk ? [...trunk.dids] : []
    if (editing && editing.inbound_did && !dids.includes(editing.inbound_did)) {
      dids.unshift(editing.inbound_did)
    }
    return dids
  }, [form.inbound_trunk_id, trunkOptions, editing])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...form,
        inbound_trunk_id: form.inbound_did ? form.inbound_trunk_id : null,
        inbound_did: form.inbound_did || null,
      }
      if (editing) {
        await api.updateRingGroup(editing.id, payload)
      } else {
        await api.createRingGroup(payload)
      }
      setShowForm(false)
      await fetchAll()
    } catch (err: any) {
      setError(err.message || t('groups.error.while.saving'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (group: RingGroup) => {
    if (!confirm(t('groups.confirm.delete', { name: group.name }))) return
    try {
      await api.deleteRingGroup(group.id)
      await fetchAll()
    } catch (err: any) {
      alert(err.message || t('groups.error.while.deleting'))
    }
  }

  if (loading) {
    return <div className="p-6 text-muted">{t('groups.loading.groups')}</div>
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface rounded-card shadow-sm border border-subtle p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-content">{t('groups.ring.groups')}</h2>
            <p className="text-sm text-muted">
              {t('groups.configure.ring.groups.with.different.ringing.strategies.members.are.chosen.from.existing.extensions')}
            </p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-hover text-on-primary rounded-input text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            {t('groups.new.group')}
          </button>
        </div>

        {groups.length === 0 ? (
          <div className="mt-6 text-sm text-muted">{t('groups.no.groups.created.yet')}</div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-muted border-b border-subtle">
                  <th className="py-2 pr-4">{t('groups.name')}</th>
                  <th className="py-2 pr-4">{t('groups.number')}</th>
                  <th className="py-2 pr-4">{t('groups.strategy')}</th>
                  <th className="py-2 pr-4">{t('groups.members')}</th>
                  <th className="py-2 pr-4">{t('groups.ring.time')}</th>
                  <th className="py-2 pr-4">{t('settings.status')}</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {groups.map(g => (
                  <tr key={g.id} className="border-b border-subtle">
                    <td className="py-3 pr-4 font-medium text-content">{g.name}</td>
                    <td className="py-3 pr-4 text-content">{g.extension}</td>
                    <td className="py-3 pr-4 text-content">
                      {STRATEGIES.find(s => s.value === g.strategy)?.label || g.strategy}
                    </td>
                    <td className="py-3 pr-4 text-content">
                      {g.members?.length ? g.members.join(', ') : '—'}
                    </td>
                    <td className="py-3 pr-4 text-content">{g.ring_time || 20}s</td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${g.enabled ? 'bg-surface-subtle text-success' : 'bg-surface-subtle text-muted'}`}>
                        {g.enabled ? t('settings.active') : t('groups.inactive')}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => openEdit(g)}
                          className="p-2 text-muted hover:text-link"
                          title={t('groups.edit')}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(g)}
                          className="p-2 text-muted hover:text-danger"
                          title={t('groups.delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900 bg-opacity-40 p-4">
          <div className="bg-surface rounded-card shadow-xl border border-subtle w-full max-w-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-subtle">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-link" />
                <h3 className="text-lg font-semibold text-content">
                  {editing ? t('groups.edit.group') : t('groups.create.group')}
                </h3>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="text-muted hover:text-muted"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="text-sm text-danger bg-surface-subtle border border-red-500 rounded-input p-3">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-content mb-1">{t('groups.name')}</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-subtle rounded-input focus:ring-2 focus:ring-link focus:border-link outline-none bg-surface text-content"
                    placeholder={t('groups.e.g.support')}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-content mb-1">{t('groups.group.number')}</label>
                  <select
                    value={form.extension}
                    onChange={e => setForm({ ...form, extension: e.target.value })}
                    className="w-full px-3 py-2 border border-subtle rounded-input focus:ring-2 focus:ring-link focus:border-link outline-none bg-surface text-content"
                    required
                  >
                    <option value="">{t('groups.please.select')}</option>
                    {availableExtensions.map(ext => (
                      <option key={ext} value={ext}>{ext}</option>
                    ))}
                  </select>
                  {availableExtensions.length === 0 && (
                    <div className="text-xs text-muted mt-1">{t('groups.no.free.numbers.in.the.1000.1999.range')}</div>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-content mb-1">{t('groups.inbound.number.optional')}</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <select
                      value={form.inbound_trunk_id ?? ''}
                      onChange={e => {
                        const nextId = e.target.value ? Number(e.target.value) : null
                        setForm({ ...form, inbound_trunk_id: nextId, inbound_did: '' })
                      }}
                      className="w-full px-3 py-2 border border-subtle rounded-input focus:ring-2 focus:ring-link focus:border-link outline-none bg-surface text-content"
                    >
                      <option value="">{t('groups.select.trunk')}</option>
                      {trunkOptions.map(t => (
                        <option key={t.trunk_id} value={t.trunk_id}>{t.trunk_name}</option>
                      ))}
                    </select>
                    <select
                      value={form.inbound_did}
                      onChange={e => setForm({ ...form, inbound_did: e.target.value })}
                      className="w-full px-3 py-2 border border-subtle rounded-input focus:ring-2 focus:ring-link focus:border-link outline-none bg-surface text-content"
                      disabled={!form.inbound_trunk_id}
                    >
                      <option value="">{t('groups.select.number')}</option>
                      {didOptions.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="text-xs text-muted mt-1">{t('groups.selects.a.free.number.from.the.trunk.block.and.creates.an.inbound.route.automatically')}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-content mb-1">{t('groups.strategy')}</label>
                  <select
                    value={form.strategy}
                    onChange={e => setForm({ ...form, strategy: e.target.value })}
                    className="w-full px-3 py-2 border border-subtle rounded-input focus:ring-2 focus:ring-link focus:border-link outline-none bg-surface text-content"
                  >
                    {STRATEGIES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-content mb-1">{t('groups.ring.time.sec')}</label>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={form.ring_time}
                    onChange={e => setForm({ ...form, ring_time: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-subtle rounded-input focus:ring-2 focus:ring-link focus:border-link outline-none bg-surface text-content"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-content mb-2">{t('groups.members.existing.extensions')}</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-auto border border-subtle rounded-input p-3">
                  {memberOptions.length === 0 && (
                    <div className="text-sm text-muted">{t('groups.no.extensions.available')}</div>
                  )}
                  {memberOptions.map(p => (
                    <label key={p.extension} className="flex items-center gap-2 text-sm text-content">
                      <input
                        type="checkbox"
                        checked={form.members.includes(p.extension)}
                        onChange={() => toggleMember(p.extension)}
                        className="rounded border-subtle text-link focus:ring-link"
                      />
                      <span>{p.extension}{p.caller_id ? ` – ${p.caller_id}` : ''}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-sm text-content">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={e => setForm({ ...form, enabled: e.target.checked })}
                    className="rounded border-subtle text-link focus:ring-link"
                  />
                  {t('settings.active')}
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 text-sm rounded-input border border-subtle text-content"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 text-sm rounded-input bg-brand hover:bg-brand-hover text-on-primary disabled:opacity-60"
                  >
                    {saving ? t('settings.saving') : t('settings.save')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
