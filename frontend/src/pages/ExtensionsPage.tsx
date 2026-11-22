import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Phone, PhoneOff, Server, RefreshCw } from 'lucide-react'
import { useI18n } from '../context/I18nContext'

interface ExtensionsPageProps {
  mode: 'peers' | 'trunks'
}
import { api } from '../services/api'

interface SIPPeer {
  id: number
  extension: string
  secret: string
  caller_id: string | null
  context: string
  pickup_group?: string | null
  enabled: boolean
  created_at: string
  updated_at: string
}

interface SIPTrunk {
  id: number
  name: string
  provider: string
  auth_mode: string
  sip_server: string
  username: string | null
  password: string | null
  caller_id: string | null
  number_block: string | null
  context: string
  codecs: string
  from_user: string | null
  enabled: boolean
  created_at: string
  updated_at: string
}

export default function ExtensionsPage({ mode }: ExtensionsPageProps) {
  const activeTab = mode
  const { t } = useI18n()
  const PROVIDERS: Record<string, { label: string; supportsIp: boolean; requiresServerInput?: boolean; server?: string; serverRegistration?: string; serverIp?: string; hint?: string }> = {
    plusnet_basic: { label: t('extensions.provider.plusnet.basic.extended'), server: 'sip.ipfonie.de', supportsIp: false },
    plusnet_connect: { label: t('extensions.provider.plusnet.extended.connect'), server: 'sipconnect.ipfonie.de', supportsIp: true },
    dusnet: { label: t('extensions.provider.dus.net'), server: 'proxy.dus.net', supportsIp: false },
    iliad_it: {
      label: t('extensions.iliad.italy'),
      supportsIp: false,
      server: 'voip.iliad.it',
      hint: t('extensions.iliad.registrar.proxy.voip.iliad.it.use.the.iliad.username.password.put.the.login.phone.number.in.from.user'),
    },
    telekom_deutschlandlan: {
      label: t('extensions.telekom.deutschlandlan.sip.trunk'),
      supportsIp: true,
      serverRegistration: 'reg.sip-trunk.telekom.de',
      serverIp: 'stat.sip-trunk.telekom.de',
      hint: t('extensions.telekom.sip.signaling.via.tcp.only.use.dns.for.outbound.proxy.do.not.pin.a.fixed.ip'),
    },
    telekom_companyflex: {
      label: t('extensions.telekom.companyflex.sip.trunk'),
      supportsIp: false,
      requiresServerInput: true,
      hint: t('extensions.outbound.proxy.contains.the.12.digit.companyflex.id.e.g.id.primary.companyflex.de'),
    },
    telekom_allip: {
      label: t('extensions.telekom.all.ip.residential'),
      supportsIp: false,
      server: 'tel.t-online.de',
      hint: t('extensions.telekom.residential.magentazuhause.use.email.as.username.and.the.phone.number.as.from.user.in.e.164.format.49'),
    },
    fritzbox: {
      label: t('extensions.provider.avm.fritz.box'),
      supportsIp: false,
      requiresServerInput: true,
      hint: t('extensions.server.your.fritz.box.ip.e.g.192.168.178.1.username.password.from.telephony.telephony.devices.telephone.lan.ip.not.the.phone.number.the.realm.is.set.to.fritz.box.automatically'),
    },
    custom: { label: t('extensions.other.provider'), supportsIp: true },
  }

  // --- Peers state ---
  const [peers, setPeers] = useState<SIPPeer[]>([])
  const [loadingPeers, setLoadingPeers] = useState(true)
  const [showPeerForm, setShowPeerForm] = useState(false)
  const [editingPeer, setEditingPeer] = useState<SIPPeer | null>(null)
  const [peerForm, setPeerForm] = useState({
    extension: '',
    secret: '',
    caller_id: '',
    context: 'internal',
    enabled: true
  })

  // --- Trunks state ---
  const [trunks, setTrunks] = useState<SIPTrunk[]>([])
  const [loadingTrunks, setLoadingTrunks] = useState(true)
  const [showTrunkForm, setShowTrunkForm] = useState(false)
  const [editingTrunk, setEditingTrunk] = useState<SIPTrunk | null>(null)
  const [trunkForm, setTrunkForm] = useState({
    name: '',
    provider: 'plusnet_basic',
    auth_mode: 'registration',
    sip_server: '',
    username: '',
    password: '',
    caller_id: '',
    number_block: '',
    from_user: '',
    enabled: true,
  })

  useEffect(() => {
    fetchPeers()
    fetchTrunks()
  }, [])

  // ==================== PEERS ====================
  const fetchPeers = async () => {
    try {
      const data = await api.getSipPeers()
      setPeers(data)
    } catch (error) {
      console.error(t('extensions.error.fetching.extensions'), error)
    } finally {
      setLoadingPeers(false)
    }
  }

  const handlePeerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingPeer) {
        await api.updateSipPeer(editingPeer.id, peerForm)
      } else {
        await api.createSipPeer(peerForm)
      }
      setPeerForm({ extension: '', secret: '', caller_id: '', context: 'internal', enabled: true })
      setShowPeerForm(false)
      setEditingPeer(null)
      fetchPeers()
    } catch (error: any) {
      alert(error.message || t('extensions.error.while.saving'))
    }
  }

  const handlePeerEdit = (peer: SIPPeer) => {
    setEditingPeer(peer)
    setPeerForm({
      extension: peer.extension,
      secret: peer.secret,
      caller_id: peer.caller_id || '',
      context: peer.context,
      enabled: peer.enabled
    })
    setShowPeerForm(true)
  }

  const handlePeerDelete = async (peer: SIPPeer) => {
    if (!confirm(t('extensions.confirm.deleteExtension', { extension: peer.extension }))) return
    try {
      await api.deleteSipPeer(peer.id)
      fetchPeers()
    } catch (error: any) {
      alert(error.message || t('extensions.error.while.deleting'))
    }
  }

  const handlePeerCancel = () => {
    setShowPeerForm(false)
    setEditingPeer(null)
    setPeerForm({ extension: '', secret: '', caller_id: '', context: 'internal', enabled: true })
  }

  // ==================== TRUNKS ====================
  const fetchTrunks = async () => {
    try {
      const data = await api.getTrunks()
      setTrunks(data)
    } catch (error) {
      console.error(t('extensions.error.fetching.trunks'), error)
    } finally {
      setLoadingTrunks(false)
    }
  }

  const handleTrunkSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const requiresServerInput = trunkForm.provider === 'custom' || PROVIDERS[trunkForm.provider]?.requiresServerInput
      const payload = {
        ...trunkForm,
        sip_server: requiresServerInput ? trunkForm.sip_server : null,
        username: trunkForm.auth_mode === 'registration' ? trunkForm.username : null,
        password: trunkForm.auth_mode === 'registration' ? trunkForm.password : null,
        from_user: trunkForm.from_user || null,
      }
      if (editingTrunk) {
        await api.updateTrunk(editingTrunk.id, payload)
      } else {
        await api.createTrunk(payload)
      }
      resetTrunkForm()
      setShowTrunkForm(false)
      setEditingTrunk(null)
      fetchTrunks()
    } catch (error: any) {
      alert(error.message || t('extensions.error.while.saving'))
    }
  }

  const handleTrunkEdit = (trunk: SIPTrunk) => {
    setEditingTrunk(trunk)
    setTrunkForm({
      name: trunk.name,
      provider: trunk.provider,
      auth_mode: trunk.auth_mode,
      sip_server: trunk.sip_server || '',
      username: trunk.username || '',
      password: trunk.password || '',
      caller_id: trunk.caller_id || '',
      number_block: trunk.number_block || '',
      from_user: trunk.from_user || '',
      enabled: trunk.enabled,
    })
    setShowTrunkForm(true)
  }

  const handleTrunkDelete = async (trunk: SIPTrunk) => {
    if (!confirm(t('extensions.confirm.deleteTrunk', { name: trunk.name }))) return
    try {
      await api.deleteTrunk(trunk.id)
      fetchTrunks()
    } catch (error: any) {
      alert(error.message || t('extensions.error.while.deleting'))
    }
  }

  const resetTrunkForm = () => {
    setTrunkForm({ name: '', provider: 'plusnet_basic', auth_mode: 'registration', sip_server: '', username: '', password: '', caller_id: '', number_block: '', from_user: '', enabled: true })
  }

  const handleTrunkCancel = () => {
    setShowTrunkForm(false)
    setEditingTrunk(null)
    resetTrunkForm()
  }

  const providerLabel = (key: string, server?: string) => {
    if (key === 'custom') return server || t('extensions.custom')
    return PROVIDERS[key]?.label || key
  }

  const getProviderServer = (provider: string, authMode: string, customServer?: string) => {
    if (provider === 'custom') return customServer || ''
    const p = PROVIDERS[provider]
    if (!p) return ''
    if (p.requiresServerInput) return customServer || ''
    if (p.server) return p.server
    if (authMode === 'registration') return p.serverRegistration || ''
    return p.serverIp || ''
  }

  const loading = activeTab === 'peers' ? loadingPeers : loadingTrunks

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-content">
            {activeTab === 'peers' ? t('extensions.extensions') : t('extensions.trunks')}
          </h1>
          <p className="text-muted mt-1">
            {activeTab === 'peers'
              ? t('extensions.create.and.manage.sip.extensions')
              : t('extensions.create.and.manage.sip.trunks')}
          </p>
        </div>

        {activeTab === 'peers' && !showPeerForm && (
          <button
            onClick={() => setShowPeerForm(true)}
            className="flex items-center gap-2 bg-brand text-on-primary px-4 py-2 rounded-input hover:bg-brand-hover transition"
          >
            <Plus className="w-5 h-5" />
            {t('extensions.new.extension')}
          </button>
        )}
        {activeTab === 'trunks' && !showTrunkForm && (
          <button
            onClick={() => setShowTrunkForm(true)}
            className="flex items-center gap-2 bg-brand text-on-primary px-4 py-2 rounded-input hover:bg-brand-hover transition"
          >
            <Plus className="w-5 h-5" />
            {t('extensions.new.trunk')}
          </button>
        )}
      </div>

      {/* ==================== PEERS TAB ==================== */}
      {activeTab === 'peers' && (
        <>
          {showPeerForm && (
            <div className="bg-surface rounded-input shadow-lg p-6 mb-8">
              <h2 className="text-xl font-semibold text-content mb-4">
                {editingPeer ? t('extensions.edit.extension') : t('extensions.create.new.extension')}
              </h2>
              <form onSubmit={handlePeerSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-content mb-1">{t('extensions.extension.number.required')}</label>
                    <input
                      type="text"
                      value={peerForm.extension}
                      onChange={(e) => setPeerForm({...peerForm, extension: e.target.value})}
                      placeholder={t('extensions.e.g.1002')}
                      className="w-full px-3 py-2 border border-subtle rounded-input focus:ring-2 focus:ring-link bg-surface text-content"
                      required
                      disabled={!!editingPeer}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-content mb-1">{t('extensions.password.required')}</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={peerForm.secret}
                        onChange={(e) => setPeerForm({...peerForm, secret: e.target.value})}
                        placeholder={t('extensions.strong.password')}
                        className="flex-1 px-3 py-2 border border-subtle rounded-input focus:ring-2 focus:ring-link bg-surface text-content"
                        required
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await api.generatePassword()
                            setPeerForm({...peerForm, secret: res.password})
                          } catch {}
                        }}
                        className="flex items-center gap-1 px-3 py-2 bg-surface-subtle hover:bg-surface-hover text-content rounded-input text-sm whitespace-nowrap"
                        title={t('extensions.generate.password')}
                      >
                        <RefreshCw className="w-4 h-4" />
                        {t('extensions.generate')}
                      </button>
                    </div>
                    {peerForm.secret && (() => {
                      const pw = peerForm.secret
                      const ext = peerForm.extension
                      let score = 0
                      const warnings: string[] = []
                      if (pw.length >= 16) score += 30
                      else if (pw.length >= 12) score += 20
                      else if (pw.length >= 8) { score += 10; warnings.push(t('extensions.at.least.12.characters.recommended')) }
                      else warnings.push(t('extensions.too.short'))
                      if (/[a-z]/.test(pw)) score += 15; else warnings.push(t('extensions.missing.lowercase.letters'))
                      if (/[A-Z]/.test(pw)) score += 15; else warnings.push(t('extensions.missing.uppercase.letters'))
                      if (/\d/.test(pw)) score += 15; else warnings.push(t('extensions.missing.digits'))
                      if (/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?/~`]/.test(pw)) score += 15; else warnings.push(t('extensions.missing.special.characters'))
                      if (ext && pw.includes(ext)) { score = Math.max(0, score - 20); warnings.push(t('extensions.contains.extension')) }
                      if (pw.length >= 20) score = Math.min(100, score + 10)
                      const level = score >= 70 ? 'strong' : score >= 40 ? 'medium' : 'weak'
                      const color = level === 'strong' ? 'bg-success' : level === 'medium' ? 'bg-warning' : 'bg-danger'
                      const label = level === 'strong' ? t('extensions.strong') : level === 'medium' ? t('extensions.medium') : t('extensions.weak')
                      return (
                        <div className="mt-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-surface-subtle rounded-full overflow-hidden">
                              <div className={`h-full ${color} transition-all`} style={{ width: `${score}%` }} />
                            </div>
                            <span className={`text-xs font-medium ${level === 'strong' ? 'text-success' : level === 'medium' ? 'text-warning' : 'text-danger'}`}>
                              {label}
                            </span>
                          </div>
                          {warnings.length > 0 && level !== 'strong' && (
                            <p className="text-xs text-muted mt-1">{warnings.join(', ')}</p>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-content mb-1">{t('extensions.caller.id')}</label>
                    <input
                      type="text"
                      value={peerForm.caller_id}
                      onChange={(e) => setPeerForm({...peerForm, caller_id: e.target.value})}
                      placeholder={t('extensions.john.doe')}
                      className="w-full px-3 py-2 border border-subtle rounded-input focus:ring-2 focus:ring-link bg-surface text-content"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-content mb-1">{t('extensions.context')}</label>
                    <select
                      value={peerForm.context}
                      onChange={(e) => setPeerForm({...peerForm, context: e.target.value})}
                      className="w-full px-3 py-2 border border-subtle rounded-input bg-surface text-content"
                    >
                      <option value="internal">{t('extensions.context.internal')}</option>
                      <option value="default">{t('extensions.context.default')}</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="peer-enabled"
                    checked={peerForm.enabled}
                    onChange={(e) => setPeerForm({...peerForm, enabled: e.target.checked})}
                    className="w-4 h-4 text-brand rounded"
                  />
                  <label htmlFor="peer-enabled" className="text-sm text-content">{t('extensions.extension.enabled')}</label>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="submit" className="px-6 py-2 bg-brand text-on-primary rounded-input hover:bg-brand-hover">
                    {editingPeer ? t('settings.save') : t('extensions.create')}
                  </button>
                  <button type="button" onClick={handlePeerCancel} className="px-6 py-2 bg-surface-subtle text-content rounded-input hover:bg-surface-hover">
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-surface rounded-input shadow">
            <div className="px-6 py-4 border-b border-subtle">
              <h2 className="text-lg font-semibold text-content">{t('extensions.active.extensions')} ({peers.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-subtle">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">{t('extensions.extension')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">{t('extensions.caller.id')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">{t('extensions.context')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">{t('settings.status')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">{t('extensions.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {peers.map((peer) => (
                    <tr key={peer.id} className="hover:bg-surface-hover">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted" />
                          <span className="font-medium text-content">{peer.extension}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-content">{peer.caller_id || '-'}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-surface-subtle text-content rounded text-sm">{peer.context}</span>
                      </td>
                      <td className="px-6 py-4">
                        {peer.enabled ? (
                          <span className="flex items-center gap-1 text-success">
                            <Phone className="w-4 h-4" /> {t('settings.active')}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted">
                            <PhoneOff className="w-4 h-4" /> {t('settings.disabled')}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button onClick={() => handlePeerEdit(peer)} className="p-2 text-link hover:bg-surface-hover rounded-input">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handlePeerDelete(peer)} className="p-2 text-danger hover:bg-surface-hover rounded-input">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ==================== TRUNKS TAB ==================== */}
      {activeTab === 'trunks' && (
        <>
          {showTrunkForm && (
            <div className="bg-surface rounded-input shadow-lg p-6 mb-8">
              <h2 className="text-xl font-semibold text-content mb-4">
                {editingTrunk ? t('extensions.edit.trunk') : t('extensions.create.new.trunk')}
              </h2>
              <form onSubmit={handleTrunkSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-content mb-1">{t('extensions.provider.required')}</label>
                    <select
                      value={trunkForm.provider}
                      onChange={(e) => {
                        const provider = e.target.value
                        setTrunkForm({
                          ...trunkForm,
                          provider,
                          sip_server: (provider === 'custom' || PROVIDERS[provider]?.requiresServerInput) ? trunkForm.sip_server : '',
                          auth_mode: PROVIDERS[provider]?.supportsIp ? trunkForm.auth_mode : 'registration',
                        })
                      }}
                      className="w-full px-3 py-2 border border-subtle rounded-input bg-surface text-content"
                    >
                      {Object.entries(PROVIDERS).map(([key, { label }]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                    {trunkForm.provider !== 'custom' && (
                      <p className="text-xs text-muted mt-1">
                        {t('extensions.server')}: {getProviderServer(trunkForm.provider, trunkForm.auth_mode, trunkForm.sip_server)}
                      </p>
                    )}
                    {PROVIDERS[trunkForm.provider]?.hint && (
                      <p className="text-xs text-muted mt-1">
                        {PROVIDERS[trunkForm.provider]?.hint}
                      </p>
                    )}
                    {trunkForm.provider === 'telekom_deutschlandlan' && (
                      <div className="mt-2 text-xs text-muted space-y-1">
                        <div>{t('extensions.sip.domain')}: <span className="font-mono">sip-trunk.telekom.de</span></div>
                        <div>{t('extensions.outbound.proxy.reg')}: <span className="font-mono">reg.sip-trunk.telekom.de</span></div>
                        <div>{t('extensions.outbound.proxy.ip')}: <span className="font-mono">stat.sip-trunk.telekom.de</span></div>
                        <div>{t('extensions.transport')}: <span className="font-medium">TCP</span> (SIP), {t('extensions.rtp.over.udp')}</div>
                        <div>{t('extensions.codecs')}: <span className="font-mono">g722, alaw</span></div>
                      </div>
                    )}
                    {trunkForm.provider === 'telekom_companyflex' && (
                      <div className="mt-2 text-xs text-muted space-y-1">
                        <div>{t('extensions.sip.domain')}: <span className="font-mono">tel.t-online.de</span></div>
                        <div>{t('extensions.outbound.proxy')}: <span className="font-mono">&lt;companyflex-id&gt;.primary.companyflex.de</span></div>
                        <div>{t('settings.username')}: <span className="font-mono">{t('extensions.registration.number')}</span></div>
                        <div>{t('extensions.auth.user')}: <span className="font-mono">+49...@tel.t-online.de</span></div>
                        <div>{t('extensions.transport')}: <span className="font-medium">TCP</span> {t('extensions.recommended')}</div>
                      </div>
                    )}
                    {trunkForm.provider === 'telekom_allip' && (
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                        <div>{t('extensions.registrar')}: <span className="font-mono">tel.t-online.de</span></div>
                        <div>{t('settings.username')}: <span className="font-mono">{t('extensions.email.address.e.g.name.t.online.de')}</span></div>
                        <div>{t('settings.password')}: <span className="font-mono">{t('extensions.email.customer.center.password')}</span></div>
                        <div>{t('extensions.from.user')}: <span className="font-mono">{t('extensions.e.164.number.49.number')}</span></div>
                        <div>{t('extensions.transport')}: <span className="font-medium">TCP</span></div>
                        <div>{t('extensions.codecs')}: <span className="font-mono">g722, alaw</span></div>
                      </div>
                    )}
                  </div>

                  {(trunkForm.provider === 'custom' || PROVIDERS[trunkForm.provider]?.requiresServerInput) && (
                    <div>
                      <label className="block text-sm font-medium text-content mb-1">
                        {trunkForm.provider === 'telekom_companyflex' ? t('extensions.outbound.proxy.required') : t('extensions.sip.server.required')}
                      </label>
                      <input
                        type="text"
                        value={trunkForm.sip_server}
                        onChange={(e) => setTrunkForm({...trunkForm, sip_server: e.target.value})}
                        placeholder={trunkForm.provider === 'telekom_companyflex' ? t('extensions.e.g.55xxxxxxxxxx.primary.companyflex.de') : t('extensions.e.g.sip.provider.com')}
                        className="w-full px-3 py-2 border border-subtle rounded-input focus:ring-2 focus:ring-link bg-surface text-content"
                        required
                      />
                    </div>
                  )}

                  {PROVIDERS[trunkForm.provider]?.supportsIp && (
                    <div>
                      <label className="block text-sm font-medium text-content mb-1">{t('extensions.auth.mode.required')}</label>
                      <select
                        value={trunkForm.auth_mode}
                        onChange={(e) => setTrunkForm({...trunkForm, auth_mode: e.target.value})}
                        className="w-full px-3 py-2 border border-subtle rounded-input bg-surface text-content"
                      >
                        <option value="registration">{t('extensions.registration.username.password')}</option>
                        <option value="ip">{t('extensions.fixed.ip.authentication')}</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-content mb-1">{t('extensions.name.required')}</label>
                    <input
                      type="text"
                      value={trunkForm.name}
                      onChange={(e) => setTrunkForm({...trunkForm, name: e.target.value})}
                      placeholder={t('extensions.e.g.plusnet.main.line')}
                      className="w-full px-3 py-2 border border-subtle rounded-input focus:ring-2 focus:ring-link bg-surface text-content"
                      required
                    />
                  </div>

                  {trunkForm.auth_mode === 'registration' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-content mb-1">{t('extensions.username.required')}</label>
                        <input
                          type="text"
                          value={trunkForm.username}
                          onChange={(e) => setTrunkForm({...trunkForm, username: e.target.value})}
                          placeholder={t('extensions.sip.username')}
                          className="w-full px-3 py-2 border border-subtle rounded-input focus:ring-2 focus:ring-link bg-surface text-content"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-content mb-1">{t('extensions.password.required')}</label>
                        <input
                          type="password"
                          value={trunkForm.password}
                          onChange={(e) => setTrunkForm({...trunkForm, password: e.target.value})}
                          placeholder={t('extensions.sip.password')}
                          className="w-full px-3 py-2 border border-subtle rounded-input focus:ring-2 focus:ring-link bg-surface text-content"
                          required
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-content mb-1">{t('extensions.number.block')}</label>
                    <input
                      type="text"
                      value={trunkForm.number_block}
                      onChange={(e) => setTrunkForm({...trunkForm, number_block: e.target.value})}
                      placeholder={t('extensions.e.g.4922112345')}
                      className="w-full px-3 py-2 border border-subtle rounded-input focus:ring-2 focus:ring-link bg-surface text-content"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-content mb-1">{t('extensions.caller.id')}</label>
                    <input
                      type="text"
                      value={trunkForm.caller_id}
                      onChange={(e) => setTrunkForm({...trunkForm, caller_id: e.target.value})}
                      placeholder={t('extensions.outbound.caller.id')}
                      className="w-full px-3 py-2 border border-subtle rounded-input focus:ring-2 focus:ring-link bg-surface text-content"
                    />
                  </div>

                  {(trunkForm.provider === 'telekom_allip' || trunkForm.provider === 'iliad_it') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {trunkForm.provider === 'iliad_it'
                          ? t('extensions.from.user.login.number.required')
                          : t('extensions.from.user.access.number.required')}
                      </label>
                      <input
                        type="text"
                        value={trunkForm.from_user}
                        onChange={(e) => setTrunkForm({...trunkForm, from_user: e.target.value})}
                        placeholder={trunkForm.provider === 'iliad_it' ? t('extensions.example.iliad.number') : t('extensions.example.access.number')}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        required
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {trunkForm.provider === 'iliad_it'
                          ? t('extensions.your.iliad.phone.number.incl.area.code.in.e.164.format.used.as.from.user.and.contact.user')
                          : t('extensions.your.access.number.in.e.164.format.used.as.from.user.and.p.preferred.identity')}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="trunk-enabled"
                    checked={trunkForm.enabled}
                    onChange={(e) => setTrunkForm({...trunkForm, enabled: e.target.checked})}
                    className="w-4 h-4 text-brand rounded"
                  />
                  <label htmlFor="trunk-enabled" className="text-sm text-content">{t('extensions.trunk.enabled')}</label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="submit" className="px-6 py-2 bg-brand text-on-primary rounded-input hover:bg-brand-hover">
                    {editingTrunk ? t('settings.save') : t('extensions.create')}
                  </button>
                  <button type="button" onClick={handleTrunkCancel} className="px-6 py-2 bg-surface-subtle text-content rounded-input hover:bg-surface-hover">
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-surface rounded-input shadow">
            <div className="px-6 py-4 border-b border-subtle">
              <h2 className="text-lg font-semibold text-content">{t('extensions.trunks')} ({trunks.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-subtle">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">{t('extensions.name')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">{t('extensions.provider')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">{t('extensions.server')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">{t('extensions.auth.mode')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">{t('settings.status')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">{t('extensions.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {trunks.map((trunk) => (
                    <tr key={trunk.id} className="hover:bg-surface-hover">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Server className="w-4 h-4 text-muted" />
                          <span className="font-medium text-content">{trunk.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-content">{providerLabel(trunk.provider, trunk.sip_server)}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-surface-subtle text-content rounded text-sm">{trunk.sip_server}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-sm ${trunk.auth_mode === 'registration' ? 'bg-surface-accent text-link' : 'bg-surface-subtle text-content'}`}>
                          {trunk.auth_mode === 'registration' ? t('extensions.registration') : t('extensions.fixed.ip')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {trunk.enabled ? (
                          <span className="flex items-center gap-1 text-success">
                            <Phone className="w-4 h-4" /> {t('settings.active')}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted">
                            <PhoneOff className="w-4 h-4" /> {t('settings.disabled')}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button onClick={() => handleTrunkEdit(trunk)} className="p-2 text-link hover:bg-surface-hover rounded-input">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleTrunkDelete(trunk)} className="p-2 text-danger hover:bg-surface-hover rounded-input">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {trunks.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-muted">
                        {t('extensions.no.trunks.configured.click.new.trunk.to.create.one')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
