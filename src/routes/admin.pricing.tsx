import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { AdminCrudPanel } from '../components/admin-crud-panel'
import { AdminModulePage } from '../components/admin-module-page'
import { Badge } from '../components/ui/badge'
import { deleteAdminCreditRate, listAdminPricing, saveAdminCreditRate, saveAdminProductPricing } from '../lib/admin.functions'
import { formatMoney } from '../lib/utils'

export const Route = createFileRoute('/admin/pricing')({
  loader: () => listAdminPricing(),
  component: AdminPricingPage,
})

function AdminPricingPage() {
  const router = useRouter()
  const { rows, stats, creditRates } = Route.useLoaderData()
  const savePricing = useServerFn(saveAdminProductPricing)
  const saveCreditRate = useServerFn(saveAdminCreditRate)
  const deleteCreditRate = useServerFn(deleteAdminCreditRate)
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const activeRate = creditRates.find((rate) => rate.active)?.rate
  const values = {
    id: editing?.id,
    priceRetail: editing?.price_retail ?? 0,
    priceDistributor: editing?.price_distributor ?? 0,
    customBundlePrice: editing?.custom_bundle_price ?? '',
    creditRequired: editing?.credit_required ?? false,
    creditValue: editing?.credit_value ?? '',
    hideRetail: editing?.hide_retail ?? false,
    hideDistributor: editing?.hide_distributor ?? false,
    rate: '',
    active: true,
  }

  return (
    <AdminModulePage
      title="Pricing"
      description="Maintain retail, distributor, custom bundle, price-list, and product-credit pricing controls."
      badge="Finance setup"
      primaryAction="New credit rate"
      onPrimaryAction={() => setEditing(null)}
      metrics={[
        { label: 'Shown products', value: stats.pricedProducts, detail: 'Latest priced records' },
        { label: 'Credit rates', value: stats.creditRates, detail: activeRate ? `Active rate ${activeRate}` : 'No active rate' },
        { label: 'Product credits', value: stats.productCredits, detail: 'Legacy credit rows' },
        { label: 'Bundle prices', value: stats.customBundlePrices, detail: 'Custom bundle overrides' },
      ]}
      rows={rows}
      columns={[
        {
          header: 'Product',
          cell: (row) => (
            <div>
              <p className="font-semibold text-[#202223]">{row.name}</p>
              <p className="mt-1 text-sm text-[#616161]">{row.sku_code || 'No SKU'}</p>
            </div>
          ),
        },
        {
          header: 'Base prices',
          cell: (row) => (
            <div className="text-sm">
              <p>{formatMoney(Number(row.price_retail))} retail</p>
              <p className="mt-1 text-[#616161]">{formatMoney(Number(row.price_distributor))} distributor</p>
            </div>
          ),
        },
        { header: 'Bundle', cell: (row) => row.custom_bundle_price ? formatMoney(Number(row.custom_bundle_price)) : 'None' },
        {
          header: 'Credits',
          cell: (row) => (
            <div className="flex flex-wrap gap-2">
              <Badge tone={row.credit_required ? 'warning' : 'neutral'}>{row.credit_required ? 'Required' : 'Optional'}</Badge>
              {row.credit_value ? <Badge tone="info">{row.credit_value}</Badge> : null}
            </div>
          ),
        },
        {
          header: 'Visibility',
          cell: (row) => [
            row.hide_retail ? 'Retail hidden' : 'Retail visible',
            row.hide_distributor ? 'Distributor hidden' : 'Distributor visible',
          ].join(' · '),
        },
      ]}
      getRowKey={(row) => row.id}
      searchPlaceholder="Search pricing records"
      emptyMessage="No pricing records found."
      rowActions={(row) => (
        <button className="polaris-button polaris-button-secondary" type="button" onClick={() => setEditing(row)}>
          <Pencil className="h-4 w-4" />
          Edit pricing
        </button>
      )}
    >
      <AdminCrudPanel
        title={editing ? 'Edit product pricing' : 'Create credit rate'}
        description={editing ? 'Updates only pricing and visibility fields on the selected product.' : 'Creates a product credit conversion rate. Marking it active deactivates the other rates.'}
        fields={editing ? [
          { name: 'priceRetail', label: 'Retail price', type: 'number', step: '0.01', min: 0 },
          { name: 'priceDistributor', label: 'Distributor price', type: 'number', step: '0.01', min: 0 },
          { name: 'customBundlePrice', label: 'Bundle price', type: 'number', step: '0.01', min: 0 },
          { name: 'creditValue', label: 'Credit value', type: 'number', step: '0.0001', min: 0 },
          { name: 'creditRequired', label: 'Credits required', type: 'checkbox' },
          { name: 'hideRetail', label: 'Hide retail', type: 'checkbox' },
          { name: 'hideDistributor', label: 'Hide distributor', type: 'checkbox' },
        ] : [
          { name: 'rate', label: 'Credit rate', type: 'number', step: '0.0001', min: 0, required: true },
          { name: 'active', label: 'Active', type: 'checkbox' },
        ]}
        initialValues={values}
        submitLabel={editing ? 'Save pricing' : 'Create credit rate'}
        busy={busy}
        message={message}
        onCancel={() => setEditing(null)}
        onSubmit={async (formValues) => {
          setBusy(true)
          try {
            if (typeof values.id === 'string') {
              await savePricing({
                data: {
                  id: values.id,
                  priceRetail: Number(formValues.priceRetail || 0),
                  priceDistributor: Number(formValues.priceDistributor || 0),
                  customBundlePrice: formValues.customBundlePrice === '' ? null : Number(formValues.customBundlePrice || 0),
                  creditRequired: Boolean(formValues.creditRequired),
                  creditValue: formValues.creditValue === '' ? null : Number(formValues.creditValue || 0),
                  hideRetail: Boolean(formValues.hideRetail),
                  hideDistributor: Boolean(formValues.hideDistributor),
                },
              })
              setMessage('Pricing saved.')
            } else {
              await saveCreditRate({ data: { rate: Number(formValues.rate || 0), active: Boolean(formValues.active) } })
              setMessage('Credit rate created.')
            }
            setEditing(null)
            await router.invalidate()
          } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Save failed.')
          } finally {
            setBusy(false)
          }
        }}
      />

      <section className="section-card p-4">
        <h2 className="section-heading">Credit rates</h2>
        <div className="mt-3 grid gap-2">
          {creditRates.map((rate) => (
            <div key={rate.id} className="list-row flex flex-wrap items-center justify-between gap-3 p-3">
              <div>
                <p className="font-semibold text-[#202223]">{rate.rate ?? 'No rate'}</p>
                <p className="section-muted mt-1">{rate.active ? 'Active' : 'Inactive'}</p>
              </div>
              <button
                className="polaris-button polaris-button-critical"
                type="button"
                onClick={async () => {
                  if (!window.confirm('Delete this credit rate?')) return
                  setBusy(true)
                  try {
                    await deleteCreditRate({ data: { id: rate.id } })
                    setMessage('Credit rate deleted.')
                    await router.invalidate()
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : 'Delete failed.')
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          ))}
        </div>
      </section>
    </AdminModulePage>
  )
}
