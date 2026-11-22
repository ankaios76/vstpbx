import { useState, useEffect } from 'react'
import { ArrowLeft, Server, CheckCircle, XCircle, Wifi, Phone, BarChart3, Clock, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { api } from '../services/api'
import { useI18n } from '../context/I18nContext'

interface Props {
  trunkId: number
  onBack: () => void
}

export default function TrunkDetailPage({ trunkId, onBack }: Props) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { t } = useI18n()
  const PROVIDER_INFO: Record<string, { label: string; logo?: string }> = {
    plusnet_basic: { label: 'Plusnet IPfonie Basic/Extended' },
    plusnet_connect: { label: 'Plusnet IPfonie Extended Connect' },
    telekom_deutschlandlan: { label: t('dashboard.provider.telekomDeutschlandLan'), logo: '/logos/telekom.jpg' },
    telekom_companyflex: { label: t('dashboard.provider.telekomCompanyFlex'), logo: '/logos/telekom.jpg' },
    telekom_allip: { label: t('dashboard.provider.telekomAllIp'), logo: '/logos/telekom.jpg' },
    iliad_it: { label: t('extensions.iliad.italy') },
    fritzbox: { label: 'AVM FRITZ!Box' },
  }

  const fetchStatus = async () => {
    try {
      const result = await api.getTrunkStatus(trunkId)
      setData(result)
      setError(null)
    } catch (err: any) {
      setError(err.message || t('trunkDetail.error.loadStatus'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 10000)
    return () => clearInterval(interval)
  }, [trunkId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button onClick={onBack} className="flex items-center gap-2 text-muted hover:text-content mb-4">
          <ArrowLeft className="w-5 h-5" />
          {t('trunkDetail.back')}
        </button>
        <div className="bg-surface-subtle border border-red-500 rounded-input p-6 text-center text-danger">
          {error || t('trunkDetail.notFound')}
        </div>
      </div>
    )
  }

  const { trunk, registration, endpoint, routes, stats } = data
  const provider = PROVIDER_INFO[trunk.provider]
  const isRegistered = registration.status === 'registered'
  const registrationStatusKey: Record<string, string> = {
    registered: 'dashboard.endpoint.registered',
    unregistered: 'dashboard.endpoint.notRegistered',
    'not registered': 'dashboard.endpoint.notRegistered',
    rejected: 'trunkDetail.registrationRejected',
    unknown: 'trunkDetail.statusUnknown',
  }
  const endpointStateKey: Record<string, string> = {
    'Not in use': 'trunkDetail.onlineIdle',
    'In use': 'trunkDetail.inUse',
    Unavailable: 'trunkDetail.unavailable',
    Unknown: 'trunkDetail.statusUnknown',
    unknown: 'trunkDetail.statusUnknown',
  }
  const registrationStatus = registration.status
    ? (registrationStatusKey[registration.status] ? t(registrationStatusKey[registration.status]) : registration.status)
    : t('dashboard.endpoint.notRegistered')
  const endpointState = endpointStateKey[endpoint.state]
    ? t(endpointStateKey[endpoint.state])
    : endpoint.state

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
        <div className="flex items-center gap-3">
          {provider?.logo ? (
            <img
              src={provider.logo}
              alt={provider.label}
              className="w-12 h-12 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            <div className="p-2 bg-surface-subtle rounded-input">
              <Server className="w-8 h-8 text-muted" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold text-content">{trunk.name}</h1>
            <p className="text-muted">
              {provider?.label || trunk.provider} &mdash; {trunk.sip_server}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Registrierung */}
        <div className="bg-surface rounded-input shadow">
          <div className="px-6 py-4 border-b border-subtle flex items-center gap-2">
            {isRegistered
              ? <CheckCircle className="w-5 h-5 text-success" />
              : <XCircle className="w-5 h-5 text-danger" />
            }
            <h2 className="text-lg font-semibold text-content">{t('extensions.registration')}</h2>
          </div>
          <div className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <div className="text-sm text-muted">{t('settings.status')}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                    isRegistered
                      ? 'bg-surface-subtle text-success'
                      : 'bg-surface-subtle text-danger'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${isRegistered ? 'bg-success' : 'bg-danger'}`} />
                    {registrationStatus}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-sm text-muted">{t('extensions.auth.mode')}</div>
                <div className="font-medium mt-1">
                  {trunk.auth_mode === 'registration' ? t('extensions.registration') : t('trunkDetail.ipAuthentication')}
                </div>
              </div>
              {registration.expires && (
                <div>
                  <div className="text-sm text-muted">{t('trunkDetail.nextRegistration')}</div>
                  <div className="font-medium mt-1 flex items-center gap-1">
                    <Clock className="w-4 h-4 text-muted" />
                    {registration.expires}
                  </div>
                </div>
              )}
            </div>

            {registration.last_response && (
              <div>
                <div className="text-sm text-muted mb-1">{t('trunkDetail.lastSipMessage')}</div>
                <pre className="bg-surface text-success text-xs p-4 rounded-input overflow-x-auto font-mono">
                  {registration.last_response}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Verbindung */}
        <div className="bg-surface rounded-input shadow">
          <div className="px-6 py-4 border-b border-subtle flex items-center gap-2">
            <Wifi className="w-5 h-5 text-muted" />
            <h2 className="text-lg font-semibold text-content">{t('trunkDetail.connection')}</h2>
          </div>
          <div className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-muted">{t('settings.server')}</div>
                <div className="font-medium mt-1 font-mono text-sm">{trunk.sip_server}</div>
              </div>
              <div>
                <div className="text-sm text-muted">{t('trunkDetail.endpointStatus')}</div>
                <div className="font-medium mt-1">
                  {endpointState}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted">{t('trunkDetail.rttLatency')}</div>
                <div className="font-medium mt-1">
                  {endpoint.rtt != null && endpoint.rtt > 0
                    ? `${endpoint.rtt} ms`
                    : t('trunkDetail.notAvailable')
                  }
                </div>
              </div>
              {endpoint.contact_uri && (
                <div className="md:col-span-3">
                  <div className="text-sm text-muted">{t('trunkDetail.contactUri')}</div>
                  <div className="font-mono text-sm mt-1 text-content break-all">{endpoint.contact_uri}</div>
                </div>
              )}
              {trunk.username && (
                <div>
                  <div className="text-sm text-muted">{t('settings.username')}</div>
                  <div className="font-medium mt-1 font-mono text-sm">{trunk.username}</div>
                </div>
              )}
              {trunk.codecs && (
                <div>
                  <div className="text-sm text-muted">{t('extensions.codecs')}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {trunk.codecs.split(',').map((c: string) => (
                      <span key={c} className="text-xs bg-surface-subtle text-content px-2 py-0.5 rounded">{c.trim()}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rufnummern */}
        <div className="bg-surface rounded-input shadow">
          <div className="px-6 py-4 border-b border-subtle flex items-center gap-2">
            <Phone className="w-5 h-5 text-muted" />
            <h2 className="text-lg font-semibold text-content">{t('extensionDetail.assignedNumbers')}</h2>
            {routes.length > 0 && (
              <span className="bg-surface-subtle text-success text-xs px-2 py-0.5 rounded-full">{routes.length}</span>
            )}
          </div>
          <div className="divide-y">
            {routes.length > 0 ? (
              routes.map((route: any) => (
                <div key={route.id} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-success" />
                    <div>
                      <span className="font-medium font-mono">{route.did}</span>
                      {route.description && (
                        <span className="text-sm text-muted ml-2">{route.description}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-muted">
                    {t('extensionDetail.target')}: <span className="font-medium">{route.destination_extension}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-6 text-center text-muted">
                {t('trunkDetail.noAssignedNumbers')}
              </div>
            )}
          </div>
          {trunk.number_block && (
            <div className="px-6 py-3 border-t border-subtle bg-surface-subtle text-sm text-muted">
              {t('extensions.number.block')}: <span className="font-mono font-medium">{trunk.number_block}</span>
            </div>
          )}
        </div>

        {/* Statistik */}
        <div className="bg-surface rounded-input shadow">
          <div className="px-6 py-4 border-b border-subtle flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-muted" />
            <h2 className="text-lg font-semibold text-content">{t('trunkDetail.statistics')}</h2>
          </div>
          <div className="px-6 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-surface-subtle rounded-input p-4 text-center">
                <div className="text-2xl font-bold text-content">{stats.calls_today}</div>
                <div className="text-sm text-muted">{t('trunkDetail.callsToday')}</div>
              </div>
              <div className="bg-surface-subtle rounded-input p-4 text-center">
                <div className="text-2xl font-bold text-content">{stats.calls_week}</div>
                <div className="text-sm text-muted">{t('trunkDetail.thisWeek')}</div>
              </div>
              <div className="bg-surface-subtle rounded-input p-4 text-center">
                <div className="flex items-center justify-center gap-1">
                  <ArrowDownLeft className="w-4 h-4 text-success" />
                  <span className="text-2xl font-bold text-success">{stats.inbound_today}</span>
                </div>
                <div className="text-sm text-success">{t('trunkDetail.inboundToday')}</div>
              </div>
              <div className="bg-surface-accent rounded-input p-4 text-center">
                <div className="flex items-center justify-center gap-1">
                  <ArrowUpRight className="w-4 h-4 text-link" />
                  <span className="text-2xl font-bold text-link">{stats.outbound_today}</span>
                </div>
                <div className="text-sm text-link">{t('trunkDetail.outboundToday')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
