import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { FinanceDecisionControls } from '../components/finance-decision-controls'
import { Badge } from '../components/ui/badge'
import { assignFinanceVerification, getFinanceOrderDetail } from '../lib/finance.functions'
import { formatDateTime, formatMoney } from '../lib/utils'

export const Route = createFileRoute('/finance/$orderId')({
  loader: ({ params }) => getFinanceOrderDetail({ data: { orderId: params.orderId } }),
  component: FinanceOrderPage,
})

function FinanceOrderPage() {
  const router = useRouter()
  const data = Route.useLoaderData()
  const assign = useServerFn(assignFinanceVerification)

  if (!data) {
    return (
      <div className="app-page">
        <section className="section-card p-4">
          <h1 className="page-title">Finance order not found</h1>
        </section>
      </div>
    )
  }

  const { order, proofs, auditTrail } = data

  async function refresh() {
    await router.invalidate()
  }

  return (
    <div className="app-page">
      <section className="page-header-row">
        <div>
          <h1 className="page-title">Finance review {order.order_number}</h1>
          <p className="page-description">{order.customer_name ?? 'No customer'} · {formatMoney(Number(order.total_amount))}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="polaris-button polaris-button-secondary" onClick={async () => { await assign({ data: { orderId: order.id } }); await refresh() }}>Assign to me</button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <article className="section-card p-4">
          <h2 className="section-heading">Payment proofs</h2>
          <div className="mt-4 space-y-3">
            {proofs.length ? proofs.map((proof) => (
              <a key={proof.id} className="list-row block p-4 text-sm" href={proof.public_url ?? '#'} target="_blank" rel="noreferrer">
                <span className="font-semibold text-[#202223]">{proof.original_filename ?? 'Payment proof'}</span>
                <span className="ml-3 text-[#616161]">{proof.proof_type ?? 'payment'}</span>
              </a>
            )) : <p className="section-muted">No payment proof files attached.</p>}
          </div>
        </article>

        <aside className="section-card p-4">
          <h2 className="section-heading">Decision</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="list-row flex justify-between p-3"><span>Payment</span><Badge tone={order.payment_status === 'verified' ? 'success' : 'warning'}>{order.payment_status ?? 'pending'}</Badge></div>
            <div className="list-row flex justify-between p-3"><span>Verification</span><span className="font-semibold">{order.verification_status ?? 'unassigned'}</span></div>
            <div className="list-row flex justify-between p-3"><span>Assignee</span><span className="font-semibold">{order.assigned_to_user_id ?? 'Unassigned'}</span></div>
            {order.remarks ? <div className="list-row grid gap-1 p-3"><span>Last remarks</span><span className="font-semibold">{order.remarks}</span></div> : null}
            {order.finance_hold_reason ? <div className="list-row grid gap-1 p-3"><span>Hold reason</span><span className="font-semibold">{order.finance_hold_reason}</span></div> : null}
            {order.rejected_reason ? <div className="list-row grid gap-1 p-3"><span>Reject reason</span><span className="font-semibold">{order.rejected_reason}</span></div> : null}
            <FinanceDecisionControls orderId={order.id} onDecision={refresh} />
          </div>
        </aside>
      </section>

      <section className="section-card p-4">
        <h2 className="section-heading">Audit trail</h2>
        <div className="mt-4 space-y-2">
          {auditTrail.map((entry) => (
            <div key={entry.id} className="list-row p-3 text-sm">
              <span className="font-semibold text-[#202223]">{entry.action}</span>
              <span className="ml-3 text-[#616161]">{entry.actor_user_id ?? 'system'} · {formatDateTime(entry.created_at)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
