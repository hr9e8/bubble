import { Link, Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'
import { ArrowRight, Boxes, Truck, Users } from 'lucide-react'
import { navigationItems } from '../lib/domain'

export const Route = createFileRoute('/admin')({ component: AdminPage })

const adminModules = navigationItems.find((item) => item.href === '/admin')?.children ?? []

function AdminPage() {
  const activeRouteId = useRouterState({ select: (state) => state.matches.at(-1)?.routeId })

  if (activeRouteId !== Route.id) {
    return <Outlet />
  }

  return (
    <div className="app-page">
      <section className="page-header">
        <h1 className="page-title">Admin foundations</h1>
        <p className="page-description">
          First build area: user roles, products, shipping configuration, warehouse platforms, and controlled stock setup.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {adminModules.map((module) => {
          const Icon = module.icon

          return (
            <article key={module.href} className="section-card">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Icon className="mb-4 h-5 w-5 text-[#008060]" />
                  <h2 className="section-heading">{module.label}</h2>
                  <p className="section-muted mt-1">{module.detail}</p>
                </div>
              </div>
              <Link to={module.href} className="polaris-button polaris-button-primary mt-5">
                Open <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          )
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="section-card">
          <Boxes className="h-5 w-5 text-[#008060]" />
          <h2 className="section-heading mt-4">Stock assignment</h2>
          <p className="section-muted mt-1">Admin-created stock movements become the source of truth for balances.</p>
        </article>
        <article className="section-card">
          <Truck className="h-5 w-5 text-[#008060]" />
          <h2 className="section-heading mt-4">Shipping matrix</h2>
          <p className="section-muted mt-1">Countries, states, zones, COD rates, courier accounts, and weight/total ranges.</p>
        </article>
        <article className="section-card">
          <Users className="h-5 w-5 text-[#008060]" />
          <h2 className="section-heading mt-4">Leader hierarchy</h2>
          <p className="section-muted mt-1">Sales leaders receive scoped access to assigned sales team members only.</p>
        </article>
      </section>
    </div>
  )
}
