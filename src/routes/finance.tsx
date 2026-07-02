import { Link, Outlet, createFileRoute, useRouter, useRouterState } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { CheckCircle2, Clock3, ShieldAlert, UserCheck } from 'lucide-react'
import { FinanceDecisionControls } from '../components/finance-decision-controls'
import { Badge } from '../components/ui/badge'
import { assignFinanceVerification, listFinanceQueue } from '../lib/finance.functions'
import { formatMoney } from '../lib/utils'

export const Route = createFileRoute('/finance')({
  loader: () => listFinanceQueue(),
  component: FinancePage,
})

function FinancePage() {
  const activeRouteId = useRouterState({ select: (state) => state.matches.at(-1)?.routeId })
  const router = useRouter()
  const queue = Route.useLoaderData()
  const assign = useServerFn(assignFinanceVerification)
  const pendingCount = queue.filter((item) => item.payment_status === 'pending').length
  const verifiedCount = queue.filter((item) => item.verification_status === 'verified').length
  const holdCount = queue.filter((item) => item.verification_status === 'finance_hold').length

  if (activeRouteId !== Route.id) {
    return <Outlet />
  }

  return (
    <div className="app-page">
      <section className="page-header">
        <h1 className="page-title">Finance verification</h1>
        <p className="page-description">Manual COD and bank-transfer payments are assigned, checked, verified, rejected, or placed on hold.</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="metric-card">
          <Clock3 className="h-5 w-5 text-amber-600" />
          <p className="metric-value mt-4">{pendingCount}</p>
          <p className="section-muted">Pending verification</p>
        </article>
        <article className="metric-card">
          <CheckCircle2 className="h-5 w-5 text-[#008060]" />
          <p className="metric-value mt-4">{verifiedCount}</p>
          <p className="section-muted">Verified today</p>
        </article>
        <article className="metric-card">
          <ShieldAlert className="h-5 w-5 text-rose-600" />
          <p className="metric-value mt-4">{holdCount}</p>
          <p className="section-muted">Finance hold</p>
        </article>
      </section>

      <section className="table-card">
        <div className="border-b border-[#dedede] p-4">
          <h2 className="section-heading">Verification queue</h2>
        </div>
        <div className="divide-y divide-[#ebebeb]">
          {queue.map((item) => (
            <div key={item.id} className="grid gap-4 p-4 text-sm xl:grid-cols-[minmax(0,1fr)_minmax(360px,520px)]">
              <div className="grid gap-3 lg:grid-cols-[140px_140px_1fr_120px_120px_auto] lg:items-start">
                <Link to="/finance/$orderId" params={{ orderId: item.id }} className="font-semibold text-[#202223]">
                  {item.order_number}
                </Link>
                <span className="text-[#616161]">{item.payment_method ?? 'Manual review'}</span>
                <span className="text-[#616161]">{item.customer_name ?? item.assigned_to_user_id ?? 'Unassigned'}</span>
                <span className="text-[#616161]">{formatMoney(Number(item.total_amount))}</span>
                <Badge tone={item.verification_status === 'finance_hold' ? 'danger' : 'warning'}>{item.verification_status ?? item.payment_status ?? 'pending'}</Badge>
                <button className="polaris-button polaris-button-secondary" onClick={async () => { await assign({ data: { orderId: item.id } }); await router.invalidate() }}>
                  <UserCheck className="h-4 w-4" /> Assign
                </button>
              </div>
              <FinanceDecisionControls orderId={item.id} compact onDecision={() => router.invalidate()} />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
