import { Link, Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Download } from 'lucide-react'
import { useState } from 'react'
import { exportCustomers, listCustomers } from '../lib/customers.functions'
import { formatInternationalPhone, formatMoney, titleCase } from '../lib/utils'

export const Route = createFileRoute('/customers')({
  loader: () => listCustomers({ data: { limit: 50 } }),
  component: CustomersPage,
})

function CustomersPage() {
  const activeRouteId = useRouterState({ select: (state) => state.matches.at(-1)?.routeId })
  const rows = Route.useLoaderData()
  const exportCustomersFn = useServerFn(exportCustomers)
  const [exporting, setExporting] = useState<'csv' | 'xlsx' | null>(null)

  if (activeRouteId !== Route.id) {
    return <Outlet />
  }

  async function handleExport(format: 'csv' | 'xlsx') {
    setExporting(format)

    try {
      const file = await exportCustomersFn({ data: { format } })
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
          <p className="page-description">Scoped customer directory backed by real seller ownership and Better Auth RBAC.</p>
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
                    <Link to="/customers/$customerId" params={{ customerId: row.id }}>
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
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
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
