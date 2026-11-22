import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../context/I18nContext'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface FAQSection {
  title: string
  items: string[]
}

const faqSections: FAQSection[] = [
  {
    title: 'faq.sections.gettingStarted',
    items: [
      'faq.gettingStarted.signIn',
      'faq.gettingStarted.changePassword',
      'faq.gettingStarted.dashboard',
    ],
  },
  {
    title: 'faq.sections.settingUpPhone',
    items: [
      'faq.settingUpPhone.registration',
      'faq.settingUpPhone.supportedDevices',
      'faq.settingUpPhone.troubleshooting',
    ],
  },
  {
    title: 'faq.sections.callsNumbers',
    items: [
      'faq.callsNumbers.inbound',
      'faq.callsNumbers.outbound',
      'faq.callsNumbers.history',
      'faq.callsNumbers.pai',
      'faq.callsNumbers.forwarding',
    ],
  },
  {
    title: 'faq.sections.administration',
    items: [
      'faq.administration.createExtension',
      'faq.administration.configureTrunk',
      'faq.administration.email',
      'faq.administration.update',
      'faq.administration.homeAssistant',
    ],
  },
]

export default function FAQPage() {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set())
  const { user } = useAuth()
  const { t, adminManualUrl } = useI18n()

  const toggleItem = (key: string) => {
    setOpenItems(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-content">{t('faq.title')}</h1>

      {user?.role === 'admin' && (
        <div className="bg-surface rounded-card shadow-sm border border-subtle overflow-hidden">
          <div className="px-6 py-4 bg-surface-subtle border-b border-subtle">
            <h2 className="text-lg font-semibold text-content">{t('faq.adminHandbook.title')}</h2>
          </div>
          <div className="px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted leading-relaxed">
              {t('faq.adminHandbook.description')}
            </p>
            <a
              href={adminManualUrl}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-input bg-brand hover:bg-brand-hover text-on-primary text-sm font-semibold shadow-sm transition-colors"
              download
            >
              {t('faq.adminHandbook.download')}
            </a>
          </div>
        </div>
      )}

      {faqSections.map((section, si) => (
        <div key={si} className="bg-surface rounded-card shadow-sm border border-subtle overflow-hidden">
          <div className="px-6 py-4 bg-surface-subtle border-b border-subtle">
            <h2 className="text-lg font-semibold text-content">{t(section.title)}</h2>
          </div>
          <div className="divide-y divide-subtle">
            {section.items.map((item, qi) => {
              const key = `${si}-${qi}`
              const isOpen = openItems.has(key)
              return (
                <div key={qi}>
                  <button
                    onClick={() => toggleItem(key)}
                    className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-surface-hover transition-colors"
                  >
                    <span className="text-sm font-medium text-content pr-4">{t(`${item}.question`)}</span>
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-muted flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-4">
                      <p className="text-sm text-muted leading-relaxed">{t(`${item}.answer`)}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
