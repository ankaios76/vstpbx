import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Phone, Plus, Trash2, Server, PhoneForwarded, PhoneOutgoing, ToggleLeft, ToggleRight, Voicemail, Save, Play, Pause, Clock, Volume2, CheckCircle } from 'lucide-react'
import { api } from '../services/api'
import { useI18n } from '../context/I18nContext'

interface Props {
  extension: string
  onBack: () => void
}

interface InboundRoute {
  id: number
  did: string
  trunk_id: number
  destination_extension: string
  description: string | null
  enabled: boolean
}

interface SIPTrunk {
  id: number
  name: string
  provider: string
  sip_server: string
  number_block: string | null
}

interface AvailableCodec {
  id: string
  name: string
  description: string
}

interface SIPPeer {
  id: number
  extension: string
  secret: string
  caller_id: string | null
  context: string
  codecs: string | null
  outbound_cid: string | null
  pai: string | null
  blf_enabled?: boolean
  pickup_group?: string | null
  enabled: boolean
}

interface CallForwardRule {
  id: number
  extension: string
  forward_type: string
  destination: string
  ring_time: number
  enabled: boolean
}

interface VoicemailMailbox {
  extension: string
  enabled: boolean
  pin: string
  name: string | null
  email: string | null
  ring_timeout: number
}

interface VoicemailMessage {
  id: number
  mailbox: string
  caller_id: string
  duration: number
  date: string
  is_read: boolean
  file_path: string
}

type DetailTab = 'numbers' | 'forwarding' | 'voicemail' | 'audio' | 'features'

export default function ExtensionDetailPage({ extension, onBack }: Props) {
  const { t, locale } = useI18n()
  const FORWARD_TYPE_LABELS: Record<string, string> = {
    unconditional: t('extensionDetail.forwardType.always'),
    busy: t('extensionDetail.forwardType.whenBusy'),
    no_answer: t('extensionDetail.forwardType.noAnswer'),
  }

  const FORWARD_TYPE_DESCRIPTIONS: Record<string, string> = {
    unconditional: t('extensionDetail.forwardType.alwaysDescription'),
    busy: t('extensionDetail.forwardType.whenBusyDescription'),
    no_answer: t('extensionDetail.forwardType.noAnswerDescription'),
  }

  const detailTabs: { id: DetailTab; label: string; icon: typeof Phone }[] = [
    { id: 'numbers', label: t('extensionDetail.tab.numbers'), icon: Phone },
    { id: 'forwarding', label: t('extensionDetail.tab.forwarding'), icon: PhoneForwarded },
    { id: 'voicemail', label: t('extensionDetail.tab.voicemail'), icon: Voicemail },
    { id: 'audio', label: t('extensionDetail.tab.audio'), icon: Volume2 },
    { id: 'features', label: t('extensionDetail.tab.features'), icon: ToggleRight },
  ]
  const [activeTab, setActiveTab] = useState<DetailTab>('numbers')
  const [peer, setPeer] = useState<SIPPeer | null>(null)
  const [routes, setRoutes] = useState<InboundRoute[]>([])
  const [allRoutes, setAllRoutes] = useState<InboundRoute[]>([])
  const [trunks, setTrunks] = useState<SIPTrunk[]>([])
  const [forwards, setForwards] = useState<CallForwardRule[]>([])
  const [clipNoScreening, setClipNoScreening] = useState(false)
  const [clipSaving, setClipSaving] = useState(false)
  const [clipError, setClipError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Route form state
  const [showRouteForm, setShowRouteForm] = useState(false)
  const [routeFormData, setRouteFormData] = useState({
    did: '',
    trunk_id: 0,
    description: '',
  })

  // Forward form state
  const [showForwardForm, setShowForwardForm] = useState(false)
  const [forwardFormData, setForwardFormData] = useState({
    forward_type: 'unconditional',
    destination: '',
    ring_time: 20,
  })

  // Voicemail state
  const [, setMailbox] = useState<VoicemailMailbox | null>(null)
  const [mailboxForm, setMailboxForm] = useState({ enabled: true, pin: '1234', name: '', email: '', ring_timeout: 20 })
  const [voicemails, setVoicemails] = useState<VoicemailMessage[]>([])
  const [savingMailbox, setSavingMailbox] = useState(false)
  const [playingId, setPlayingId] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  // Outbound CID / PAI state
  const [outboundCid, setOutboundCid] = useState<string>('')
  const [pai, setPai] = useState<string>('')
  const [savingOutbound, setSavingOutbound] = useState(false)
  const [outboundSaved, setOutboundSaved] = useState(false)
  const [outboundDirty, setOutboundDirty] = useState(false)

  // Codec state
  const [availableCodecs, setAvailableCodecs] = useState<AvailableCodec[]>([])
  const [globalCodecs, setGlobalCodecs] = useState<string[]>([])
  const [useGlobalCodecs, setUseGlobalCodecs] = useState(true)
  const [peerCodecs, setPeerCodecs] = useState<string[]>([])
  const [savingCodecs, setSavingCodecs] = useState(false)

  // BLF state
  const [blfEnabled, setBlfEnabled] = useState(true)
  const [savingBlf, setSavingBlf] = useState(false)
  const [pickupGroup, setPickupGroup] = useState('')
  const [savingPickup, setSavingPickup] = useState(false)

  useEffect(() => {
    fetchData()
  }, [extension])

  const fetchData = async () => {
    try {
      const [peersData, routesData, trunksData, forwardsData, allRoutesData, codecData] = await Promise.all([
        api.getSipPeers(),
        api.getRoutesByExtension(extension),
        api.getTrunks(),
        api.getCallForwards(extension),
        api.getRoutes(),
        api.getCodecSettings(),
      ])
      const currentPeer = peersData.find((p: SIPPeer) => p.extension === extension) || null
      setPeer(currentPeer)

      // Outbound CID / PAI setup (deferred until routes are available below)
      // Will be set after setRoutes

      // Codec setup
      const gCodecs = (codecData.global_codecs || '').split(',').filter(Boolean)
      setAvailableCodecs(codecData.available_codecs || [])
      setGlobalCodecs(gCodecs)
      if (currentPeer?.codecs) {
        setUseGlobalCodecs(false)
        setPeerCodecs(currentPeer.codecs.split(',').filter(Boolean))
      } else {
        setUseGlobalCodecs(true)
        setPeerCodecs(gCodecs)
      }
      setRoutes(routesData)
      setAllRoutes(allRoutesData || [])
      setTrunks(trunksData)
      setForwards(forwardsData)
      api.getCallForwardingSettings()
        .then(cf => setClipNoScreening(!!cf.forward_clip_no_screening))
        .catch(() => { /* Einstellung ist optional, Ansicht funktioniert auch ohne */ })
      if (trunksData.length > 0 && routeFormData.trunk_id === 0) {
        setRouteFormData(f => ({ ...f, trunk_id: trunksData[0].id }))
      }

      // Initialize outbound CID / PAI from peer
      setOutboundCid(currentPeer?.outbound_cid || '')
      setPai(currentPeer?.pai || '')
      setBlfEnabled(currentPeer?.blf_enabled ?? true)
      setPickupGroup(currentPeer?.pickup_group || '')

      // Fetch voicemail mailbox config
      try {
        const mbData = await api.getVoicemailMailbox(extension)
        setMailbox(mbData)
        setMailboxForm({
          enabled: mbData.enabled,
          pin: mbData.pin || '1234',
          name: mbData.name || '',
          email: mbData.email || '',
          ring_timeout: mbData.ring_timeout || 20,
        })
      } catch {
        setMailbox(null)
      }

      // Fetch voicemail messages
      try {
        const vmData = await api.getVoicemails(extension)
        setVoicemails(vmData)
      } catch {
        setVoicemails([])
      }
    } catch (error) {
      console.error(t('extensionDetail.error.fetchData'), error)
    } finally {
      setLoading(false)
    }
  }

  // ==================== ROUTES ====================
  const handleAddRoute = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.createRoute({
        did: routeFormData.did,
        trunk_id: routeFormData.trunk_id,
        destination_extension: extension,
        description: routeFormData.description || null,
        enabled: true,
      })
      setRouteFormData({ did: '', trunk_id: trunks[0]?.id || 0, description: '' })
      setShowRouteForm(false)
      fetchData()
    } catch (error: any) {
      alert(error.message || t('extensionDetail.error.assignNumber'))
    }
  }

  const handleDeleteRoute = async (route: InboundRoute) => {
    if (!confirm(t('extensionDetail.confirm.removeNumber', { number: route.did }))) return
    try {
      await api.deleteRoute(route.id)
      fetchData()
    } catch (error: any) {
      alert(error.message || t('extensionDetail.error.delete'))
    }
  }

  const getTrunkName = (trunkId: number) => {
    return trunks.find(t => t.id === trunkId)?.name || t('extensionDetail.trunkFallback', { id: trunkId })
  }

  // ==================== CALL FORWARDS ====================
  const handleAddForward = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.createCallForward({
        extension,
        forward_type: forwardFormData.forward_type,
        destination: forwardFormData.destination,
        ring_time: forwardFormData.ring_time,
        enabled: true,
      })
      setForwardFormData({ forward_type: 'unconditional', destination: '', ring_time: 20 })
      setShowForwardForm(false)
      fetchData()
    } catch (error: any) {
      alert(error.message || t('extensionDetail.error.createForward'))
    }
  }

  const handleToggleClipNoScreening = async (enabled: boolean) => {
    setClipSaving(true)
    setClipError(null)
    const previous = clipNoScreening
    setClipNoScreening(enabled)
    try {
      await api.updateCallForwardingSettings({ forward_clip_no_screening: enabled })
    } catch (e: any) {
      setClipNoScreening(previous)
      setClipError(e?.message || t('extensionDetail.error.saveForwardSettings'))
    } finally {
      setClipSaving(false)
    }
  }

  const handleToggleForward = async (fwd: CallForwardRule) => {
    try {
      await api.updateCallForward(fwd.id, { enabled: !fwd.enabled })
      fetchData()
    } catch (error: any) {
      alert(error.message || t('extensionDetail.error.update'))
    }
  }

  const handleDeleteForward = async (fwd: CallForwardRule) => {
    if (!confirm(t('extensionDetail.confirm.deleteForward', { type: FORWARD_TYPE_LABELS[fwd.forward_type] }))) return
    try {
      await api.deleteCallForward(fwd.id)
      fetchData()
    } catch (error: any) {
      alert(error.message || t('extensionDetail.error.delete'))
    }
  }

  // ==================== VOICEMAIL ====================
  const handleSaveMailbox = async () => {
    setSavingMailbox(true)
    try {
      await api.updateVoicemailMailbox(extension, {
        enabled: mailboxForm.enabled,
        pin: mailboxForm.pin,
        name: mailboxForm.name || null,
        email: mailboxForm.email || null,
        ring_timeout: mailboxForm.ring_timeout,
      })
      const mbData = await api.getVoicemailMailbox(extension)
      setMailbox(mbData)
    } catch (error: any) {
      alert(error.message || t('extensionDetail.error.saveVoicemail'))
    } finally {
      setSavingMailbox(false)
    }
  }

  const handlePlayVoicemail = (vm: VoicemailMessage) => {
    if (playingId === vm.id) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }
    const baseUrl = `${window.location.protocol}//${window.location.host}`
    const token = localStorage.getItem('token')
    if (audioRef.current) {
      audioRef.current.src = `${baseUrl}/api/voicemail/${vm.id}/audio?token=${token}`
      audioRef.current.play()
      setPlayingId(vm.id)
      audioRef.current.onended = () => setPlayingId(null)
    }
    if (!vm.is_read) {
      api.markVoicemailRead(vm.id).then(() => fetchData())
    }
  }

  const handleDeleteVoicemail = async (vm: VoicemailMessage) => {
    if (!confirm(t('extensionDetail.confirm.deleteVoicemail')))
    try {
      await api.deleteVoicemail(vm.id)
      if (playingId === vm.id) {
        audioRef.current?.pause()
        setPlayingId(null)
      }
      setVoicemails(prev => prev.filter(v => v.id !== vm.id))
    } catch (error: any) {
      alert(error.message || t('extensionDetail.error.delete'))
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffMins < 60) {
      return t(diffMins === 1 ? 'extensionDetail.time.minuteAgo' : 'extensionDetail.time.minutesAgo', { count: diffMins })
    }
    if (diffHours < 24) return t('extensionDetail.time.hoursAgo', { count: diffHours })
    if (diffDays < 7) {
      return t(diffDays === 1 ? 'extensionDetail.time.dayAgo' : 'extensionDetail.time.daysAgo', { count: diffDays })
    }
    return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  // ==================== OUTBOUND CID / PAI ====================
  const handleSaveOutbound = async () => {
    if (!peer) return
    setSavingOutbound(true)
    setOutboundSaved(false)
    try {
      await api.updatePeerOutbound(peer.id, {
        outbound_cid: outboundCid || null,
        pai: pai || null,
      })
      setOutboundSaved(true)
      setOutboundDirty(false)
      fetchData()
      setTimeout(() => setOutboundSaved(false), 5000)
    } catch (error: any) {
      alert(error.message || t('extensionDetail.error.saveOutboundCallerId'))
    } finally {
      setSavingOutbound(false)
    }
  }

  const handleSaveBlf = async () => {
    if (!peer) return
    setSavingBlf(true)
    try {
      await api.updateSipPeer(peer.id, {
        extension: peer.extension,
        secret: peer.secret,
        caller_id: peer.caller_id || '',
        context: peer.context || 'internal',
        codecs: peer.codecs,
        enabled: peer.enabled,
        blf_enabled: blfEnabled,
        pickup_group: pickupGroup || null,
      })
    } catch (err) {
      console.error(t('extensionDetail.error.updateBlf'), err)
    } finally {
      setSavingBlf(false)
    }
  }

  const handleSavePickup = async () => {
    if (!peer) return
    setSavingPickup(true)
    try {
      await api.updateSipPeer(peer.id, {
        extension: peer.extension,
        secret: peer.secret,
        caller_id: peer.caller_id || '',
        context: peer.context || 'internal',
        codecs: peer.codecs,
        enabled: peer.enabled,
        blf_enabled: blfEnabled,
        pickup_group: pickupGroup || null,
      })
    } catch (err) {
      console.error(t('extensionDetail.error.updatePickupGroup'), err)
    } finally {
      setSavingPickup(false)
    }
  }

  const handleOutboundCidChange = (value: string) => {
    setOutboundCid(value === routes[0]?.did ? '' : value)
    setOutboundDirty(true)
    setOutboundSaved(false)
  }

  const handlePaiChange = (value: string) => {
    setPai(value)
    setOutboundDirty(true)
    setOutboundSaved(false)
  }

  // ==================== CODECS ====================
  const handleToggleGlobalCodecs = (useGlobal: boolean) => {
    setUseGlobalCodecs(useGlobal)
    if (useGlobal) {
      setPeerCodecs(globalCodecs)
    }
  }

  const togglePeerCodec = (codecId: string) => {
    setPeerCodecs(prev =>
      prev.includes(codecId) ? prev.filter(c => c !== codecId) : [...prev, codecId]
    )
  }

  const handleSaveCodecs = async () => {
    if (!peer) return
    if (!useGlobalCodecs && peerCodecs.length === 0) {
      alert(t('extensionDetail.error.codecRequired'))
      return
    }
    setSavingCodecs(true)
    try {
      await api.updatePeerCodecs(peer.id, useGlobalCodecs ? null : peerCodecs.join(','))
      fetchData()
    } catch (error: any) {
      alert(error.message || t('extensionDetail.error.saveCodecs'))
    } finally {
      setSavingCodecs(false)
    }
  }

  // Available forward types (exclude already configured ones)
  const availableForwardTypes = Object.keys(FORWARD_TYPE_LABELS).filter(
    type => !forwards.some(f => f.forward_type === type)
  )

  // Badge counts
  const unreadVoicemails = voicemails.filter(v => !v.is_read).length
  const activeForwards = forwards.filter(f => f.enabled).length

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="p-2 rounded-input hover:bg-surface-hover transition"
        >
          <ArrowLeft className="w-5 h-5 text-muted" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-content">
            {peer?.caller_id || extension}
          </h1>
          <p className="text-muted">{t('extensionDetail.extension')} {extension}</p>
        </div>
      </div>

      {/* Ausgehende Rufnummer - immer sichtbar wenn vorhanden */}
      {routes.length > 0 && (
        <div className="bg-surface-accent border border-subtle rounded-input px-6 py-4 mb-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-surface-accent rounded-full mt-1">
              <PhoneOutgoing className="w-5 h-5 text-link" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <div className="text-sm text-link font-medium mb-1">{t('extensionDetail.outboundCallerId')}</div>
                <select
                  value={outboundCid || routes[0].did}
                  onChange={(e) => handleOutboundCidChange(e.target.value)}
                  className="w-full max-w-xs px-3 py-2 border border-subtle border-subtle rounded-input bg-surface text-content text-sm focus:ring-2 focus:ring-link"
                >
                  {routes.map((route, index) => (
                    <option key={route.id} value={route.did}>
                      {route.did}{index === 0 && !peer?.outbound_cid ? ` (${t('extensionDetail.default')})` : ''}{route.description ? ` — ${route.description}` : ''}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-link mt-1">
                  {t('extensionDetail.outboundCallerIdSentVia', {
                    trunk: getTrunkName((routes.find(r => r.did === (outboundCid || routes[0].did)) || routes[0]).trunk_id),
                  })}
                </div>
              </div>
              <div>
                <div className="text-sm text-link font-medium mb-1">{t('extensionDetail.paiHeading')}</div>
                <input
                  type="text"
                  value={pai}
                  onChange={(e) => handlePaiChange(e.target.value)}
                  placeholder={t('extensionDetail.examplePai')}
                  className="w-full max-w-xs px-3 py-2 border border-subtle border-subtle rounded-input bg-surface text-content text-sm focus:ring-2 focus:ring-link"
                />
                <div className="text-xs text-link mt-1">
                  {t('extensionDetail.paiDescription')}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveOutbound}
                  disabled={savingOutbound || !outboundDirty}
                  className={`flex items-center gap-2 px-4 py-2 rounded-input transition text-sm disabled:opacity-50 ${
                    outboundDirty
                      ? 'bg-brand text-on-primary hover:bg-brand-hover'
                      : 'bg-surface-subtle bg-surface-subtle text-muted'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  {savingOutbound ? t('extensionDetail.saving') : t('extensionDetail.save')}
                </button>
                {outboundSaved && (
                  <span className="flex items-center gap-1.5 text-success text-sm font-medium animate-fade-in">
                    <CheckCircle className="w-4 h-4" />
                    {t('extensionDetail.outboundSaved')}
                  </span>
                )}
                {outboundDirty && !outboundSaved && (
                  <span className="text-warning text-warning text-xs">{t('extensionDetail.unsavedChanges')}</span>
                )}
              </div>

              {/* Aktive Konfiguration */}
              {!outboundDirty && !outboundSaved && (peer?.outbound_cid || peer?.pai) && (
                <div className="bg-surface border border-subtle border-subtle rounded-input px-4 py-3 mt-1">
                  <div className="text-xs font-semibold text-link uppercase tracking-wide mb-2">{t('extensionDetail.activeConfiguration')}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted">{t('extensionDetail.callerId')}: </span>
                      <span className="font-mono font-medium text-content">{peer?.outbound_cid || routes[0].did}</span>
                      {!peer?.outbound_cid && <span className="text-muted text-xs ml-1">({t('extensionDetail.default')})</span>}
                    </div>
                    <div>
                      <span className="text-muted">PAI: </span>
                      {peer?.pai ? (
                        <span className="font-mono font-medium text-content">{peer.pai}</span>
                      ) : (
                        <span className="text-muted">{t('extensionDetail.notSet')}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-subtle mb-6">
        <nav className="flex flex-wrap gap-1" aria-label={t('extensionDetail.tabs')}>
          {detailTabs.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-accent text-accent'
                    : 'border-transparent text-muted hover:text-content hover:border-subtle'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.id === 'voicemail' && unreadVoicemails > 0 && (
                  <span className="bg-ink-100 text-content text-xs px-1.5 py-0.5 rounded-full leading-none">
                    {unreadVoicemails}
                  </span>
                )}
                {tab.id === 'forwarding' && activeForwards > 0 && (
                  <span className="bg-ink-100 text-content text-xs px-1.5 py-0.5 rounded-full leading-none">
                    {activeForwards}
                  </span>
                )}
                {tab.id === 'numbers' && routes.length > 0 && (
                  <span className="bg-ink-100 text-content text-xs px-1.5 py-0.5 rounded-full leading-none">
                    {routes.length}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* ==================== Rufnummern Tab ==================== */}
      {activeTab === 'numbers' && (
        <div className="bg-surface rounded-input shadow">
          <div className="px-6 py-4 border-b border-subtle flex justify-between items-center">
            <h2 className="text-lg font-semibold text-content">{t('extensionDetail.assignedNumbers')}</h2>
            {!showRouteForm && trunks.length > 0 && (
              <button
                onClick={() => setShowRouteForm(true)}
                className="flex items-center gap-2 bg-brand text-on-primary px-4 py-2 rounded-input hover:bg-brand-hover transition text-sm"
              >
                <Plus className="w-4 h-4" />
                {t('extensionDetail.assignNumber')}
              </button>
            )}
          </div>

          {showRouteForm && (() => {
            const selectedTrunk = trunks.find(t => t.id === routeFormData.trunk_id)
            const assignedDids = allRoutes.filter(r => r.trunk_id === routeFormData.trunk_id)
            return (
            <div className="px-6 py-4 border-b border-subtle bg-surface-subtle">
              <form onSubmit={handleAddRoute} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-content mb-1">{t('extensionDetail.trunkRequired')}</label>
                    <select
                      value={routeFormData.trunk_id}
                      onChange={(e) => setRouteFormData({ ...routeFormData, trunk_id: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-subtle rounded-input bg-surface text-content"
                      required
                    >
                      {trunks.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-content mb-1">{t('extensionDetail.numberRequired')}</label>
                    <input
                      type="text"
                      value={routeFormData.did}
                      onChange={(e) => setRouteFormData({ ...routeFormData, did: e.target.value })}
                      placeholder={t('extensionDetail.exampleNumber')}
                      className="w-full px-3 py-2 border border-subtle rounded-input focus:ring-2 focus:ring-link bg-surface text-content"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-content mb-1">{t('extensionDetail.description')}</label>
                    <input
                      type="text"
                      value={routeFormData.description}
                      onChange={(e) => setRouteFormData({ ...routeFormData, description: e.target.value })}
                      placeholder={t('extensionDetail.exampleMainNumber')}
                      className="w-full px-3 py-2 border border-subtle rounded-input focus:ring-2 focus:ring-link bg-surface text-content"
                    />
                  </div>
                </div>

                {selectedTrunk && (
                  <div className="bg-surface border border-subtle rounded-input p-4">
                    <div className="text-sm font-medium text-content mb-2">
                      {t('extensionDetail.numberBlockFor')} "{selectedTrunk.name}"
                    </div>
                    {selectedTrunk.number_block ? (
                      <div className="text-sm text-muted font-mono bg-surface-subtle px-3 py-1.5 rounded inline-block">
                        {selectedTrunk.number_block}
                      </div>
                    ) : (
                      <div className="text-sm text-muted italic">{t('extensionDetail.noNumberBlock')}</div>
                    )}
                    {assignedDids.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs text-muted mb-1">{t('extensionDetail.assignedNumbersOnTrunk')}</div>
                        <div className="flex flex-wrap gap-2">
                          {assignedDids.map(r => (
                            <span key={r.id} className="text-xs bg-surface-subtle text-warning border border-yellow-600 px-2 py-1 rounded font-mono">
                              {r.did} → {r.destination_extension}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3">
                  <button type="submit" className="px-4 py-2 bg-brand text-on-primary rounded-input hover:bg-brand-hover text-sm">
                    {t('extensionDetail.assign')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRouteForm(false)
                      setRouteFormData({ did: '', trunk_id: trunks[0]?.id || 0, description: '' })
                    }}
                    className="px-4 py-2 bg-surface-subtle text-content rounded-input hover:bg-surface-hover text-sm"
                  >
                    {t('extensionDetail.cancel')}
                  </button>
                </div>
              </form>
            </div>
            )
          })()}

          <div className="divide-y divide-subtle">
            {routes.length > 0 ? (
              routes.map((route, index) => (
                <div key={route.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Phone className="w-5 h-5 text-success" />
                    <div>
                      <div className="font-medium text-content flex items-center gap-2">
                        {route.did}
                        <span className="text-xs bg-surface-subtle text-success px-1.5 py-0.5 rounded">{t('extensionDetail.inbound')}</span>
                        {(outboundCid ? route.did === outboundCid : index === 0) && (
                          <span className="text-xs bg-surface-accent text-link px-1.5 py-0.5 rounded">{t('extensionDetail.outbound')}</span>
                        )}
                      </div>
                      <div className="text-sm text-muted flex items-center gap-2">
                        <Server className="w-3 h-3" />
                        {getTrunkName(route.trunk_id)}
                        {route.description && (
                          <span className="text-muted">— {route.description}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteRoute(route)}
                    className="p-2 text-danger hover:bg-surface-hover rounded-input"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            ) : (
              <div className="px-6 py-8 text-center text-muted">
                {trunks.length > 0
                  ? t('extensionDetail.noAssignedNumbers')
                  : t('extensionDetail.createTrunkFirst')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== Funktionen Tab ==================== */}
      {activeTab === 'features' && (
        <div className="bg-surface rounded-input shadow">
          <div className="px-6 py-4 border-b border-subtle">
            <h2 className="text-lg font-semibold text-content">{t('extensionDetail.tab.features')}</h2>
            <p className="text-sm text-muted">{t('extensionDetail.featuresDescription')}</p>
          </div>

          {/* BLF */}
          <div className="px-6 py-4 border-b border-subtle bg-surface-subtle/40">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-content">{t('extensionDetail.blfLabel')}</div>
                <div className="text-xs text-muted">
                  {t('extensionDetail.blfDescription')}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setBlfEnabled((v) => !v)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-input text-sm ${
                    blfEnabled
                      ? 'bg-surface-subtle text-success bg-surface-subtle'
                      : 'bg-surface-subtle text-content bg-surface-subtle text-content'
                  }`}
                >
                  {blfEnabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  {blfEnabled ? t('extensionDetail.active') : t('extensionDetail.inactive')}
                </button>
                <button
                  type="button"
                  onClick={handleSaveBlf}
                  disabled={savingBlf}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-on-primary rounded-input hover:bg-brand-hover text-sm disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  {savingBlf ? t('extensionDetail.saving') : t('extensionDetail.save')}
                </button>
              </div>
            </div>
          </div>

          {/* Pickup Group */}
          <div className="px-6 py-4 border-b border-subtle bg-surface-subtle/40">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-content">{t('extensionDetail.pickupGroup')}</div>
                <div className="text-xs text-muted">
                  {t('extensionDetail.pickupGroupDescription')}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={pickupGroup}
                  onChange={(e) => setPickupGroup(e.target.value)}
                  placeholder={t('extensionDetail.examplePickupGroups')}
                  className="w-40 px-3 py-2 border border-subtle rounded-input bg-surface text-content text-sm"
                />
                <button
                  type="button"
                  onClick={handleSavePickup}
                  disabled={savingPickup}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-on-primary rounded-input hover:bg-brand-hover text-sm disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  {savingPickup ? t('extensionDetail.saving') : t('extensionDetail.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Rufumleitung Tab ==================== */}
      {activeTab === 'forwarding' && (
        <div className="bg-surface rounded-input shadow">
          <div className="px-6 py-4 border-b border-subtle flex justify-between items-center">
            <h2 className="text-lg font-semibold text-content">{t('extensionDetail.callForwarding')}</h2>
            {!showForwardForm && availableForwardTypes.length > 0 && (
              <button
                onClick={() => {
                  setForwardFormData(f => ({ ...f, forward_type: availableForwardTypes[0] }))
                  setShowForwardForm(true)
                }}
                className="flex items-center gap-2 bg-brand text-on-primary px-4 py-2 rounded-input hover:bg-brand-hover transition text-sm"
              >
                <Plus className="w-4 h-4" />
                {t('extensionDetail.addForwarding')}
              </button>
            )}
          </div>

          <div className="px-6 py-4 border-b border-subtle bg-surface-subtle/40">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={clipNoScreening}
                disabled={clipSaving}
                onChange={e => handleToggleClipNoScreening(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-subtle text-brand focus:ring-link disabled:opacity-50"
              />
              <span className="text-sm">
                <span className="font-medium text-content">
                  {t('extensionDetail.clipForwardedCalls')}
                </span>
                <span className="block text-muted mt-0.5">
                  {t('extensionDetail.clipForwardedCallsDescription')}
                </span>
                {clipSaving && (
                  <span className="block text-muted mt-1">
                    {t('extensionDetail.rewritingDialplan')}
                  </span>
                )}
                {clipError && (
                  <span className="block text-danger mt-1">{clipError}</span>
                )}
              </span>
            </label>
          </div>

          {showForwardForm && (
            <div className="px-6 py-4 border-b border-subtle bg-surface-subtle">
              <form onSubmit={handleAddForward} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-content mb-1">{t('extensionDetail.typeRequired')}</label>
                    <select
                      value={forwardFormData.forward_type}
                      onChange={(e) => setForwardFormData({ ...forwardFormData, forward_type: e.target.value })}
                      className="w-full px-3 py-2 border border-subtle rounded-input bg-surface text-content"
                      required
                    >
                      {availableForwardTypes.map(type => (
                        <option key={type} value={type}>{FORWARD_TYPE_LABELS[type]}</option>
                      ))}
                    </select>
                    <p className="text-xs text-muted mt-1">
                      {FORWARD_TYPE_DESCRIPTIONS[forwardFormData.forward_type]}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-content mb-1">{t('extensionDetail.destinationNumberRequired')}</label>
                    <input
                      type="text"
                      value={forwardFormData.destination}
                      onChange={(e) => setForwardFormData({ ...forwardFormData, destination: e.target.value })}
                      placeholder={t('extensionDetail.exampleDestinationNumber')}
                      className="w-full px-3 py-2 border border-subtle rounded-input focus:ring-2 focus:ring-link bg-surface text-content"
                      required
                    />
                  </div>
                  {forwardFormData.forward_type === 'no_answer' && (
                    <div>
                      <label className="block text-sm font-medium text-content mb-1">{t('extensionDetail.ringTimeSeconds')}</label>
                      <input
                        type="number"
                        value={forwardFormData.ring_time}
                        onChange={(e) => setForwardFormData({ ...forwardFormData, ring_time: Number(e.target.value) })}
                        min={5}
                        max={120}
                        className="w-full px-3 py-2 border border-subtle rounded-input focus:ring-2 focus:ring-link bg-surface text-content"
                      />
                      <p className="text-xs text-muted mt-1">
                        {t('extensionDetail.ringTimeDescription')}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button type="submit" className="px-4 py-2 bg-brand text-on-primary rounded-input hover:bg-brand-hover text-sm">
                    {t('extensionDetail.createForwarding')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForwardForm(false)
                      setForwardFormData({ forward_type: 'unconditional', destination: '', ring_time: 20 })
                    }}
                    className="px-4 py-2 bg-surface-subtle text-content rounded-input hover:bg-surface-hover text-sm"
                  >
                    {t('extensionDetail.cancel')}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="divide-y divide-subtle">
            {forwards.length > 0 ? (
              forwards.map(fwd => (
                <div key={fwd.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <PhoneForwarded className={`w-5 h-5 ${fwd.enabled ? 'text-warning text-warning' : 'text-muted'}`} />
                    <div>
                      <div className="font-medium text-content flex items-center gap-2">
                        {FORWARD_TYPE_LABELS[fwd.forward_type]}
                        {!fwd.enabled && (
                          <span className="text-xs bg-surface-subtle text-muted px-2 py-0.5 rounded">{t('extensionDetail.disabled')}</span>
                        )}
                      </div>
                      <div className="text-sm text-muted">
                        {t('extensionDetail.target')}: {fwd.destination}
                        {fwd.forward_type === 'no_answer' && (
                          <span className="ml-2 text-muted">({fwd.ring_time}s {t('extensionDetail.ringTime')})</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleForward(fwd)}
                      className={`p-2 rounded-input transition ${fwd.enabled ? 'text-success hover:bg-surface-hover' : 'text-muted hover:bg-surface-hover'}`}
                      title={fwd.enabled ? t('extensionDetail.disable') : t('extensionDetail.enable')}
                    >
                      {fwd.enabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                    </button>
                    <button
                      onClick={() => handleDeleteForward(fwd)}
                      className="p-2 text-danger hover:bg-surface-hover rounded-input"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-8 text-center text-muted">
                {t('extensionDetail.noForwarding')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== Voicemail Tab ==================== */}
      {activeTab === 'voicemail' && (
        <div className="space-y-6">
          {/* Voicemail Config */}
          <div className="bg-surface rounded-input shadow">
            <div className="px-6 py-4 border-b border-subtle flex justify-between items-center">
              <h2 className="text-lg font-semibold text-content">{t('extensionDetail.voicemailSettings')}</h2>
              <button
                onClick={() => setMailboxForm(f => ({ ...f, enabled: !f.enabled }))}
                className={`p-2 rounded-input transition ${mailboxForm.enabled ? 'text-success hover:bg-surface-hover' : 'text-muted hover:bg-surface-hover'}`}
                title={mailboxForm.enabled ? t('extensionDetail.disable') : t('extensionDetail.enable')}
              >
                {mailboxForm.enabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
              </button>
            </div>

            <div className="px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-content mb-1">{t('extensionDetail.pin')}</label>
                  <input
                    type="text"
                    value={mailboxForm.pin}
                    onChange={(e) => setMailboxForm({ ...mailboxForm, pin: e.target.value })}
                    placeholder="1234"
                    className="w-full px-3 py-2 border border-subtle rounded-input focus:ring-2 focus:ring-link bg-surface text-content"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-content mb-1">{t('extensionDetail.name')}</label>
                  <input
                    type="text"
                    value={mailboxForm.name}
                    onChange={(e) => setMailboxForm({ ...mailboxForm, name: e.target.value })}
                    placeholder={extension}
                    className="w-full px-3 py-2 border border-subtle rounded-input focus:ring-2 focus:ring-link bg-surface text-content"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-content mb-1">{t('extensionDetail.emailOptional')}</label>
                  <input
                    type="email"
                    value={mailboxForm.email}
                    onChange={(e) => setMailboxForm({ ...mailboxForm, email: e.target.value })}
                    placeholder="user@example.com"
                    className="w-full px-3 py-2 border border-subtle rounded-input focus:ring-2 focus:ring-link bg-surface text-content"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-content mb-1">{t('extensionDetail.ringDurationSeconds')}</label>
                  <input
                    type="number"
                    value={mailboxForm.ring_timeout}
                    onChange={(e) => setMailboxForm({ ...mailboxForm, ring_timeout: Number(e.target.value) })}
                    min={5}
                    max={120}
                    className="w-full px-3 py-2 border border-subtle rounded-input focus:ring-2 focus:ring-link bg-surface text-content"
                  />
                  <p className="text-xs text-muted mt-1">{t('extensionDetail.ringDurationDescription')}</p>
                </div>
              </div>
              <button
                onClick={handleSaveMailbox}
                disabled={savingMailbox}
                className="flex items-center gap-2 bg-brand text-on-primary px-4 py-2 rounded-input hover:bg-brand-hover transition text-sm disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {savingMailbox ? t('extensionDetail.saving') : t('extensionDetail.save')}
              </button>
            </div>
          </div>

          {/* Voicemail Messages */}
          {mailboxForm.enabled && (
            <div className="bg-surface rounded-input shadow">
              <div className="px-6 py-4 border-b border-subtle">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-content">{t('extensionDetail.messages')}</h2>
                  {unreadVoicemails > 0 && (
                    <span className="bg-ink-100 text-content text-xs px-2 py-0.5 rounded-full">
                      {t('extensionDetail.unreadMessages', { count: unreadVoicemails })}
                    </span>
                  )}
                </div>
              </div>

              <audio ref={audioRef} className="hidden" />

              <div className="divide-y divide-subtle">
                {voicemails.length > 0 ? (
                  voicemails.map(vm => (
                    <div
                      key={vm.id}
                      className={`px-6 py-4 flex items-center justify-between ${!vm.is_read ? 'bg-surface-accent' : ''}`}
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <button
                          onClick={() => handlePlayVoicemail(vm)}
                          className={`p-2 rounded-full transition flex-shrink-0 ${playingId === vm.id ? 'bg-brand text-on-primary' : 'bg-surface-subtle text-muted hover:bg-surface-hover'}`}
                        >
                          {playingId === vm.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <div className="min-w-0">
                          <div className="font-medium text-content flex items-center gap-2">
                            <span className="truncate">{vm.caller_id || t('extensionDetail.unknown')}</span>
                            {!vm.is_read && (
                              <span className="text-xs bg-surface-accent text-content px-1.5 py-0.5 rounded-input flex-shrink-0">{t('extensionDetail.new')}</span>
                            )}
                          </div>
                          <div className="text-sm text-muted flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(vm.date)}
                            </span>
                            <span>{formatDuration(vm.duration)}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteVoicemail(vm)}
                        className="p-2 text-danger hover:bg-surface-hover rounded-input flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="px-6 py-8 text-center text-muted">
                    {t('extensionDetail.noVoicemailMessages')}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== Audio Tab ==================== */}
      {activeTab === 'audio' && (
        <div className="bg-surface rounded-input shadow">
          <div className="px-6 py-4 border-b border-subtle">
            <h2 className="text-lg font-semibold text-content">{t('extensionDetail.tab.audio')}</h2>
          </div>

          <div className="px-6 py-4">
            <label className="flex items-center gap-3 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={useGlobalCodecs}
                onChange={(e) => handleToggleGlobalCodecs(e.target.checked)}
                className="w-4 h-4 text-link border-subtle rounded focus:ring-link"
              />
              <div>
                <span className="text-sm font-medium text-content">{t('extensionDetail.useGlobalCodecs')}</span>
                <span className="block text-xs text-muted">
                  {t('extensionDetail.currentGlobalCodecs')}: {globalCodecs.join(', ') || t('extensionDetail.none')}
                </span>
              </div>
            </label>

            {!useGlobalCodecs && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {availableCodecs.map(codec => (
                  <label
                    key={codec.id}
                    className={`flex items-start gap-3 p-3 rounded-input border cursor-pointer transition ${
                      peerCodecs.includes(codec.id)
                        ? 'border-link border-subtle bg-surface-accent'
                        : 'border-subtle hover:border-subtle'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={peerCodecs.includes(codec.id)}
                      onChange={() => togglePeerCodec(codec.id)}
                      className="mt-0.5 w-4 h-4 text-link border-subtle rounded focus:ring-link"
                    />
                    <div>
                      <div className="text-sm font-medium text-content">{codec.name}</div>
                      <div className="text-xs text-muted">{codec.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <button
              onClick={handleSaveCodecs}
              disabled={savingCodecs}
              className="flex items-center gap-2 bg-brand text-on-primary px-4 py-2 rounded-input hover:bg-brand-hover transition text-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {savingCodecs ? t('extensionDetail.saving') : t('extensionDetail.saveCodecs')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
