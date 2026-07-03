import { Link, Outlet, createFileRoute, stripSearchParams, useNavigate, useRouterState } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Download, Filter, Search } from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'
import { exportCustomers, listCustomerDirectory } from '../lib/customers.functions'
import { formatInternationalPhone, formatMoney, titleCase } from '../lib/utils'

const defaultCustomerSearch = {
  segment: 'all' as const,
  query: '',
  minOrders: '',
  maxOrders: '',
  lastOrder: '',
  sellerUserId: '',
  state: '',
  country: '',
}

const customerSearchSchema = z.object({
  segment: z.enum(['all', 'best', 'atRisk']).default(defaultCustomerSearch.segment).catch(defaultCustomerSearch.segment),
  query: z.string().default(defaultCustomerSearch.query).catch(defaultCustomerSearch.query),
  minOrders: z.string().default(defaultCustomerSearch.minOrders).catch(defaultCustomerSearch.minOrders),
  maxOrders: z.string().default(defaultCustomerSearch.maxOrders).catch(defaultCustomerSearch.maxOrders),
  lastOrder: z.string().default(defaultCustomerSearch.lastOrder).catch(defaultCustomerSearch.lastOrder),
  sellerUserId: z.string().default(defaultCustomerSearch.sellerUserId).catch(defaultCustomerSearch.sellerUserId),
  state: z.string().default(defaultCustomerSearch.state).catch(defaultCustomerSearch.state),
  country: z.string().default(defaultCustomerSearch.country).catch(defaultCustomerSearch.country),
})

export const Route = createFileRoute('/customers')({
  validateSearch: customerSearchSchema,
  loaderDeps: ({ search }) => ({
    segment: search.segment,
    query: search.query,
    minOrders: search.minOrders,
    maxOrders: search.maxOrders,
    lastOrder: search.lastOrder,
    sellerUserId: search.sellerUserId,
    state: search.state,
    country: search.country,
  }),
  loader: ({ deps }) => listCustomerDirectory({
    data: {
      segment: deps.segment,
      query: deps.query || undefined,
      minOrders: parseOptionalNumber(deps.minOrders),
      maxOrders: parseOptionalNumber(deps.maxOrders),
      lastOrder: isLastOrderFilter(deps.lastOrder) ? deps.lastOrder : undefined,
      sellerUserId: deps.sellerUserId || undefined,
      state: deps.state || undefined,
      country: deps.country || undefined,
      limit: 50,
    },
  }),
  search: {
    middlewares: [stripSearchParams(defaultCustomerSearch)],
  },
  component: CustomersPage,
})

function CustomersPage() {
  const activeRouteId = useRouterState({ select: (state) => state.matches.at(-1)?.routeId })
  const navigate = useNavigate({ from: '/customers' })
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const rows = data.rows
  const exportCustomersFn = useServerFn(exportCustomers)
  const [exporting, setExporting] = useState<'csv' | 'xlsx' | null>(null)
  const hasFilters = Boolean(search.query || search.minOrders || search.maxOrders || search.lastOrder || search.sellerUserId || search.state || search.country || search.segment !== 'all')

  if (activeRouteId !== Route.id) {
    return <Outlet />
  }

  function updateSearch(updates: Partial<typeof search>) {
    void navigate({
      search: (previous) => ({
        ...previous,
        ...updates,
      }),
    })
  }

  async function handleExport(format: 'csv' | 'xlsx') {
    setExporting(format)

    try {
      const file = await exportCustomersFn({ data: { format, ...customerFiltersFromSearch(search) } })
      downloadBase64File(file)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="app-page">
      <section className="page-header-row">
        <div>
          <h1 className="page-title">Customers</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="polaris-button polaris-button-secondary" type="button" disabled={exporting !== null} onClick={() => void handleExport('csv')}>
            <Download className="h-4 w-4" /> {exporting === 'csv' ? 'Exporting CSV' : 'Export CSV'}
          </button>
          <button className="polaris-button polaris-button-primary" type="button" disabled={exporting !== null} onClick={() => void handleExport('xlsx')}>
            <Download className="h-4 w-4" /> {exporting === 'xlsx' ? 'Exporting XLSX' : 'Export XLSX'}
          </button>
        </div>
      </section>

      <section className="customers-filter-card">
        <div className="customers-filter-tabs" role="tablist" aria-label="Customer segments">
          <button className={tabClass(search.segment === 'all')} type="button" onClick={() => updateSearch({ segment: 'all' })}>
            All customers
          </button>
          <button className={tabClass(search.segment === 'best')} type="button" onClick={() => updateSearch({ segment: 'best' })}>
            Best customers
          </button>
          <button className={tabClass(search.segment === 'atRisk')} type="button" onClick={() => updateSearch({ segment: 'atRisk' })}>
            At-risk customers
          </button>
        </div>

        <div className="customers-filter-grid">
          <label className="customers-search-control">
            <Search className="h-4 w-4 shrink-0 text-[#8a8a8a]" />
            <input
              className="customers-search-input"
              placeholder="Search name, email, or phone"
              value={search.query}
              onChange={(event) => updateSearch({ query: event.target.value })}
            />
          </label>
          <input className="customers-filter-control" inputMode="numeric" min="0" placeholder="Min lifetime orders" value={search.minOrders} onChange={(event) => updateSearch({ minOrders: event.target.value })} />
          <input className="customers-filter-control" inputMode="numeric" min="0" placeholder="Max lifetime orders" value={search.maxOrders} onChange={(event) => updateSearch({ maxOrders: event.target.value })} />
          <select className="customers-filter-control" value={search.lastOrder} aria-label="Last order date" onChange={(event) => updateSearch({ lastOrder: event.target.value })}>
            <option value="">Any last order</option>
            <option value="last30">Last 30 days</option>
            <option value="last60">Last 60 days</option>
            <option value="last90">Last 90 days</option>
            <option value="older90">Older than 90 days</option>
            <option value="none">No orders</option>
          </select>
          <select className="customers-filter-control" value={search.sellerUserId} aria-label="Seller" onChange={(event) => updateSearch({ sellerUserId: event.target.value })}>
            <option value="">All sellers</option>
            {data.filters.sellers.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select className="customers-filter-control" value={search.state} aria-label="State" onChange={(event) => updateSearch({ state: event.target.value })}>
            <option value="">All states</option>
            {data.filters.states.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select className="customers-filter-control" value={search.country} aria-label="Country" onChange={(event) => updateSearch({ country: event.target.value })}>
            <option value="">All countries</option>
            {data.filters.countries.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="customers-filter-footer">
          <p className="section-muted">{rows.length.toLocaleString('en-MY')} customers shown</p>
          <button className="polaris-button polaris-button-secondary" type="button" disabled={!hasFilters} onClick={() => updateSearch(defaultCustomerSearch)}>
            <Filter className="h-4 w-4" /> Reset filters
          </button>
        </div>
      </section>

      <section className="table-card">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>City</th>
                <th>LTV (RM)</th>
                <th>Lifetime Orders</th>
                <th>Last Order Date</th>
                <th>Sellers</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="font-semibold text-[#202223]">
                    <Link to="/customers/$customerId" params={{ customerId: row.id }} className="app-link app-link-neutral">
                      {titleCase(row.name)}
                    </Link>
                  </td>
                  <td>{row.email ?? 'No email'}</td>
                  <td>{formatInternationalPhone(row.phone, row.country) || 'No phone'}</td>
                  <td>{[titleCase(row.city), titleCase(row.state)].filter(Boolean).join(', ') || 'Unknown'}</td>
                  <td>{formatMoney(Number(row.lifetime_value))}</td>
                  <td>{Number(row.lifetime_orders).toLocaleString('en-MY')}</td>
                  <td>{formatCustomerDate(row.last_order_date)}</td>
                  <td>{row.seller_names || 'Unassigned'}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#616161]">
                    No customers found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return undefined

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

function isLastOrderFilter(value: string): value is 'last30' | 'last60' | 'last90' | 'older90' | 'none' {
  return ['last30', 'last60', 'last90', 'older90', 'none'].includes(value)
}

function customerFiltersFromSearch(search: typeof defaultCustomerSearch) {
  return {
    segment: search.segment,
    query: search.query || undefined,
    minOrders: parseOptionalNumber(search.minOrders),
    maxOrders: parseOptionalNumber(search.maxOrders),
    lastOrder: isLastOrderFilter(search.lastOrder) ? search.lastOrder : undefined,
    sellerUserId: search.sellerUserId || undefined,
    state: search.state || undefined,
    country: search.country || undefined,
  }
}

function tabClass(active: boolean) {
  return `customers-filter-tab${active ? ' customers-filter-tab-active' : ''}`
}

function downloadBase64File(file: { filename: string; mimeType: string; base64: string }) {
  const binary = window.atob(file.base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  const url = window.URL.createObjectURL(new Blob([bytes], { type: file.mimeType }))
  const link = document.createElement('a')
  link.href = url
  link.download = file.filename
  link.click()
  window.URL.revokeObjectURL(url)
}

function formatCustomerDate(value: Date | string | null) {
  if (!value) return 'No orders yet'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'

  return new Intl.DateTimeFormat('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}
