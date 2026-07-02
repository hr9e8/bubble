import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { authClient } from '../lib/auth-client'

export const Route = createFileRoute('/logout')({ component: LogoutPage })

function LogoutPage() {
  const navigate = useNavigate()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function runLogout() {
    if (isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    try {
      const result = await authClient.signOut()

      if (result.error) {
        setError(result.error.message ?? 'Unable to end the current session.')
        return
      }

      await router.invalidate()
      await navigate({ to: '/login', search: { redirect: '/' } })
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'Unable to end the current session.')
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    void runLogout()
  }, [])

  return (
    <div className="app-page">
      <section className="section-card">
        <h1 className="page-title">Logout</h1>
        <p className="page-description">Session logout clears the Better Auth session and returns you to the login screen.</p>
        {error ? <p className="mt-4 text-sm font-medium text-rose-700">{error}</p> : null}
        <button className="polaris-button polaris-button-secondary mt-4" onClick={() => void runLogout()} disabled={isSubmitting}>
          {isSubmitting ? 'Ending session…' : 'End session'}
        </button>
      </section>
    </div>
  )
}
