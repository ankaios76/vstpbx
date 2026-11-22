import { useState, FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { Logo } from '../components/Logo'
import { useI18n } from '../context/I18nContext'

export default function LoginPage() {
  const demoHint = (import.meta.env.VITE_DEMO_HINT as string | undefined) || ''
  const { login } = useAuth()
  const { t } = useI18n()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(username, password)
    } catch (err: any) {
      setError(err.message || t('login.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-subtle flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-surface rounded-card border border-subtle p-8">
          <div className="flex justify-center mb-8">
            <Logo className="h-11 w-auto max-w-full" />
          </div>

          <h2 className="font-headline text-center text-2xl font-bold text-content mb-6">
            {t('login.signIn')}
          </h2>

          {error && (
            <div className="bg-surface-subtle border border-red-500 text-danger px-4 py-3 rounded-input mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-content mb-1">
                {t('settings.username')}
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                className="w-full px-4 py-2.5 border border-subtle rounded-input focus:ring-2 focus:ring-link focus:border-link outline-none transition-colors bg-surface text-content"
                placeholder={t('login.usernamePlaceholder')}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-content mb-1">
                {t('settings.password')}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-subtle rounded-input focus:ring-2 focus:ring-link focus:border-link outline-none transition-colors bg-surface text-content"
                placeholder={t('login.passwordPlaceholder')}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand hover:bg-brand-hover disabled:opacity-50 text-on-primary font-medium py-2.5 px-4 rounded-input transition-colors"
            >
              {loading ? t('login.signingIn') : t('login.signIn')}
            </button>
          </form>
        </div>

        {demoHint && (
          <div className="mt-4 rounded-card border border-subtle bg-surface p-4 text-sm text-content text-center">
            {demoHint}
          </div>
        )}

        <p className="text-center text-muted text-xs mt-6">
          {t('login.tagline')}
        </p>
      </div>
    </div>
  )
}
