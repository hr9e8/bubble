import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { authClient } from '../lib/auth-client'
import { bootstrapInitialAdmin, getAuthBootstrapStatus } from '../lib/auth.functions'

function sanitizeRedirect(redirectTarget: unknown) {
  if (typeof redirectTarget !== 'string') return '/'
  if (!redirectTarget.startsWith('/') || redirectTarget.startsWith('//')) return '/'
  return redirectTarget
}

export const Route = createFileRoute('/login')({
  validateSearch: (search) => ({
    redirect: sanitizeRedirect(search.redirect),
  }),
  beforeLoad: ({ context, search }) => {
    if (context.currentUser) {
      throw redirect({
        to: search.redirect,
      })
    }
  },
  loader: () => getAuthBootstrapStatus(),
  component: LoginPage,
})

function LoginPage() {
  const router = useRouter()
  const search = Route.useSearch()
  const { requiresSetup } = Route.useLoaderData()
  const bootstrapInitialAdminFn = useServerFn(bootstrapInitialAdmin)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      if (requiresSetup) {
        await bootstrapInitialAdminFn({
          data: {
            email,
            name,
            password,
          },
        })
      } else {
        const result = await authClient.signIn.email({
          email,
          password,
          rememberMe: true,
        })

        if (result.error) {
          setError(result.error.message ?? 'Unable to sign in with those credentials.')
          return
        }
      }

      await router.invalidate()
      window.location.assign(search.redirect)
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Authentication failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="app-page">
      <section className="mx-auto grid w-full max-w-md gap-4 rounded-xl border border-[#dedede] bg-white p-6 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
        <div>
          <h1 className="page-title">{requiresSetup ? 'Create initial admin' : 'Login'}</h1>
          <p className="page-description">
            {requiresSetup
              ? 'No Better Auth users exist yet. Create the first admin account to unlock the protected operations routes.'
              : 'Use Better Auth email and password credentials to access HQ OCOC.'}
          </p>
        </div>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          {requiresSetup ? (
            <label className="form-field">
              <span className="form-label">Full name</span>
              <input className="form-input" type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Operations admin" />
            </label>
          ) : null}
          <label className="form-field">
            <span className="form-label">Email</span>
            <input className="form-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@ococ.my" />
          </label>
          <label className="form-field">
            <span className="form-label">Password</span>
            <input className="form-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}
          <button className="polaris-button polaris-button-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Working…' : requiresSetup ? 'Create admin account' : 'Sign in'}
          </button>
        </form>
      </section>
    </div>
  )
}
