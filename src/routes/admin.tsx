import { Link, Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'
import { ArrowRight, Boxes, Package, PackagePlus, Plug, ReceiptText, Settings2, ShieldCheck, Truck, Upload, Users } from 'lucide-react'

export const Route = createFileRoute('/admin')({ component: AdminPage })

const adminModules = [
  {
    title: 'Users',
    detail: 'App profiles, role assignment, platform links, sales leaders, and warehouse relations.',
    href: '/admin/users',
    icon: Users,
  },
  {
    title: 'Roles and permissions',
    detail: 'Define role permission grants and audit-sensitive administrative access.',
    href: '/admin/roles',
    icon: ShieldCheck,
  },
  {
    title: 'Products',
    detail: 'Product parity fields, categories, images, supplier data, visibility, and reorder levels.',
    href: '/admin/products',
    icon: Package,
  },
  {
    title: 'Bundles',
    detail: 'Build bundle products from child product line items.',
    href: '/admin/bundles',
    icon: PackagePlus,
  },
  {
    title: 'Pricing',
    detail: 'Retail, distributor, bundle, price-list, and product-credit controls.',
    href: '/admin/pricing',
    icon: ReceiptText,
  },
  {
    title: 'Shipping',
    detail: 'Countries, states, zones, COD rates, couriers, and shipping matrices.',
    href: '/admin/shipping',
    icon: Truck,
  },
  {
    title: 'Couriers',
    detail: 'Courier directory, account IDs, tracking URLs, and AWB references.',
    href: '/admin/couriers',
    icon: Truck,
  },
  {
    title: 'Platforms',
    detail: 'Sales platforms, warehouse platforms, website owners, and order prefixes.',
    href: '/admin/platforms',
    icon: Settings2,
  },
  {
    title: 'Stock setup',
    detail: 'Lots, balances, warehouses, movement ledger, and controlled assignment.',
    href: '/admin/stocks',
    icon: Boxes,
  },
  {
    title: 'Warehouses',
    detail: 'Warehouse platforms, user relations, stock locations, and fulfillment ownership.',
    href: '/admin/warehouses',
    icon: Truck,
  },
  {
    title: 'WooCommerce',
    detail: 'Connect stores, test reachability, queue imports, and receive webhooks.',
    href: '/admin/woocommerce',
    icon: Plug,
  },
  {
    title: 'Migration',
    detail: 'Run Bubble CSV profiling, raw staging, transforms, and reconciliation checks.',
    href: '/admin/migration',
    icon: Upload,
  },
] as const

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
                  <h2 className="section-heading">{module.title}</h2>
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
