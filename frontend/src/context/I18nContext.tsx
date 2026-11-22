import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type Language = string

type LocaleCatalog = {
  meta: {
    name: string
    locale: string
    direction: 'ltr' | 'rtl'
    title: string
    description: string
    adminManualUrl?: string
  }
  messages: Record<string, string>
}

const localeFiles = import.meta.glob<LocaleCatalog>('../locales/*.json', {
  eager: true,
  import: 'default',
})

const localeCatalogs = Object.entries(localeFiles).reduce<Record<string, LocaleCatalog>>((catalogs, [path, catalog]) => {
  const language = path.split('/').pop()?.replace(/\.json$/, '').toLowerCase()
  if (language) catalogs[language] = catalog
  return catalogs
}, {})

if (!localeCatalogs.en) {
  throw new Error('The English locale catalog (src/locales/en.json) is required')
}

function getDefaultAdminManualUrl(): string {
  const url = localeCatalogs.en.meta.adminManualUrl
  if (!url) throw new Error('The English locale catalog must define adminManualUrl')
  return url
}

const DEFAULT_ADMIN_MANUAL_URL = getDefaultAdminManualUrl()

export const LANGUAGES: Record<string, { name: string; locale: string; rtl?: boolean }> =
  Object.fromEntries(
    Object.entries(localeCatalogs)
      .sort(([first], [second]) => first === 'en' ? -1 : second === 'en' ? 1 : first.localeCompare(second))
      .map(([code, catalog]) => [code, {
        name: catalog.meta.name,
        locale: catalog.meta.locale,
        rtl: catalog.meta.direction === 'rtl',
      }]),
  )

const STORAGE_KEY = 'ui_language'
const DEFAULT_LANG = 'en'

function normalizeLanguage(value: string | undefined): Language {
  if (!value) return DEFAULT_LANG
  const normalized = value.trim().toLowerCase().replace('_', '-')
  if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(normalized)) return DEFAULT_LANG
  return normalized in LANGUAGES ? normalized : normalized.split('-')[0]
}

function getInitialLanguage(): Language {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) return normalizeLanguage(stored)
  const configured = import.meta.env.VITE_UI_LANG as string | undefined
  if (configured) return normalizeLanguage(configured)
  return DEFAULT_LANG
}

type I18nContextValue = {
  lang: Language
  setLang: (lang: Language) => void
  tr: (de: string, en: string, it?: string) => string
  locale: string
  t: (key: string, params?: Record<string, string | number>) => string
  adminManualUrl: string
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(getInitialLanguage)

  const setLang = (nextLang: Language) => {
    const normalized = normalizeLanguage(nextLang)
    setLangState(normalized)
  }

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang)
    document.documentElement.lang = lang
    const metadata = localeCatalogs[lang]?.meta ?? localeCatalogs.en.meta
    document.documentElement.dir = metadata.direction
    document.title = metadata.title
    document.querySelector<HTMLMetaElement>('meta[name="description"]')
      ?.setAttribute('content', metadata.description)
  }, [lang])

  const value = useMemo<I18nContextValue>(() => ({
    lang,
    setLang,
    tr: (de: string, en: string, it?: string) => {
      if (lang === 'it') return it ?? en
      if (lang === 'en') return en
      if (lang === 'de') return de
      return it ?? en ?? de
    },
    locale: LANGUAGES[lang]?.locale || lang,
    adminManualUrl: localeCatalogs[lang]?.meta.adminManualUrl ?? DEFAULT_ADMIN_MANUAL_URL,
    t: (key, params) => {
      let message = localeCatalogs[lang]?.messages[key] ?? localeCatalogs.en.messages[key] ?? key
      if (params) {
        for (const [name, replacement] of Object.entries(params)) {
          message = message.split(`{${name}}`).join(String(replacement))
        }
      }
      return message
    },
  }), [lang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
