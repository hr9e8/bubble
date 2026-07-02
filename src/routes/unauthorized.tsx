import { createFileRoute } from '@tanstack/react-router'
import { ShieldAlert } from 'lucide-react'

export const Route = createFileRoute('/unauthorized')({ component: UnauthorizedPage })

function UnauthorizedPage() {
  return (
    <div className="app-page">
      <section className="section-card">
        <ShieldAlert className="h-6 w-6 text-rose-600" />
        <h1 className="page-title mt-4">Unauthorized</h1>
        <p className="page-description">Your account does not have permission for this operational area.</p>
      </section>
    </div>
  )
}
