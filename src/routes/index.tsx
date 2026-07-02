import { createFileRoute } from '@tanstack/react-router'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip } from '../components/ui/chart'
import { Badge } from '../components/ui/badge'
import { getDashboardMetrics } from '../lib/dashboard.functions'
import { formatMoney, formatNumber } from '../lib/utils'

export const Route = createFileRoute('/')({
  loader: () => getDashboardMetrics(),
  component: Home,
})

function Home() {
  const data = Route.useLoaderData()

  return (
    <div className="app-page">
      <section className="page-header-row">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-description">Live operational summary for the current Better Auth user and their permitted sales scope.</p>
        </div>
        <Badge tone="info">{data.currentUser.scope.toUpperCase()} scope</Badge>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Orders', value: data.orders, detail: `${data.currentUser.roles.join(', ')} access` },
          { label: 'Customers', value: data.customers, detail: 'Scoped seller-owned records' },
          { label: 'Pending finance', value: data.pendingFinance, detail: 'Visible when finance access exists' },
          { label: 'Ready to pack', value: data.readyToPack, detail: 'Visible when warehouse access exists' },
        ].map((stat) => (
          <article key={stat.label} className="metric-card">
            <p className="metric-label">{stat.label}</p>
            <p className="metric-value mt-3">{formatNumber(stat.value)}</p>
            <p className="section-muted mt-4">{stat.detail}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="section-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-heading">Monthly order value</h2>
            <span className="section-muted font-medium">{formatMoney(data.monthlySales.reduce((sum, month) => sum + month.revenue, 0))} tracked</span>
          </div>
          <ChartContainer className="border-0 p-0 shadow-none">
            <BarChart data={data.monthlySales} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid vertical={false} stroke="#ebebeb" strokeDasharray="3 3" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={72} />
              <ChartTooltip />
              <Bar dataKey="revenue" fill="#008060" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>

        <aside className="section-card">
          <h2 className="section-heading">Order pipeline</h2>
          <div className="mt-4 space-y-3">
            {data.orderPipeline.map((item) => (
              <div key={item.status} className="list-row flex items-center justify-between gap-4 px-3 py-3">
                <span className="section-muted font-medium">{item.status}</span>
                <span className="text-sm font-semibold text-[#202223]">{formatNumber(item.count)}</span>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </div>
  )
}
