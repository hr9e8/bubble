import { createFileRoute } from '@tanstack/react-router'
import { getCustomerDetail } from '../lib/customers.functions'
import { formatInternationalPhone, titleCase } from '../lib/utils'

export const Route = createFileRoute('/customers/$customerId')({
  loader: ({ params }) => getCustomerDetail({ data: { customerId: params.customerId } }),
  component: CustomerDetailPage,
})

function CustomerDetailPage() {
  const customer = Route.useLoaderData()

  if (!customer) {
    return (
      <div className="app-page">
        <section className="section-card">
          <h1 className="page-title">Customer not found</h1>
          <p className="page-description">The requested customer is outside the current sales scope or has not been imported yet.</p>
        </section>
      </div>
    )
  }

  return (
    <div className="app-page">
      <section className="page-header">
        <h1 className="page-title">{titleCase(customer.name)}</h1>
        <p className="page-description">Customer profile backed by the canonical imported record and seller ownership scope.</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="section-card">
          <h2 className="section-heading">Contact</h2>
          <div className="mt-4 grid gap-3 text-sm text-[#202223]">
            <div className="list-row flex items-center justify-between p-3">
              <span>Email</span>
              <span className="font-semibold">{customer.email ?? 'No email'}</span>
            </div>
            <div className="list-row flex items-center justify-between p-3">
              <span>Phone</span>
              <span className="font-semibold">{formatInternationalPhone(customer.phone, customer.country) || 'No phone'}</span>
            </div>
            <div className="list-row flex items-center justify-between p-3">
              <span>Sellers</span>
              <span className="font-semibold">{customer.seller_names || 'Unassigned'}</span>
            </div>
          </div>
        </article>
        <article className="section-card">
          <h2 className="section-heading">Address</h2>
          <p className="section-muted mt-3 text-sm">
            {[titleCase(customer.address_line), titleCase(customer.city), titleCase(customer.state), titleCase(customer.country), customer.zip_code].filter(Boolean).join(', ') || 'No address captured yet.'}
          </p>
          {customer.note ? <p className="section-muted mt-4 text-sm">Note: {customer.note}</p> : null}
        </article>
      </section>
    </div>
  )
}
