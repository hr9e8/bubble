import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { AdminCrudPanel } from '../components/admin-crud-panel'
import { AdminModulePage } from '../components/admin-module-page'
import { Badge } from '../components/ui/badge'
import { deleteAdminShippingZone, listAdminShipping, saveAdminShippingZone } from '../lib/admin.functions'

export const Route = createFileRoute('/admin/shipping')({
  loader: () => listAdminShipping(),
  component: AdminShippingPage,
})

function AdminShippingPage() {
  const router = useRouter()
  const { rows, stats } = Route.useLoaderData()
  const saveZone = useServerFn(saveAdminShippingZone)
  const deleteZone = useServerFn(deleteAdminShippingZone)
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const values = {
    id: editing?.id,
    zoneName: editing?.zone_name ?? '',
    active: editing?.active ?? true,
    applyAllProduct: editing?.apply_all_product ?? false,
    countryLegacyId: editing?.country_legacy_id ?? '',
    applyProductsRaw: editing?.apply_products_raw ?? '',
    statesRaw: editing?.states_raw ?? '',
    shippingRateRaw: editing?.shipping_rate_raw ?? '',
    shippingCodRateRaw: editing?.shipping_cod_rate_raw ?? '',
  }

  return (
    <AdminModulePage
      title="Shipping"
      description="Configure countries, states, zones, products, shipping rates, COD rates, and matrix matching."
      badge="Shipping matrix"
      primaryAction="New zone"
      onPrimaryAction={() => setEditing(null)}
      metrics={[
        { label: 'Zones', value: stats.zones, detail: 'Shipping zone records' },
        { label: 'Countries', value: stats.countries, detail: 'Country setup rows' },
        { label: 'States', value: stats.states, detail: 'State matrix rows' },
        { label: 'Rates', value: stats.rates + stats.codRates, detail: 'Shipping and COD rates' },
      ]}
      rows={rows}
      columns={[
        {
          header: 'Zone',
          cell: (row) => (
            <div>
              <p className="font-semibold text-[#202223]">{row.zone_name}</p>
              <p className="mt-1 text-sm text-[#616161]">{row.country_legacy_id || 'No country link'}</p>
            </div>
          ),
        },
        { header: 'Status', cell: (row) => <Badge tone={row.active ? 'success' : 'warning'}>{row.active ? 'Active' : 'Inactive'}</Badge> },
        { header: 'Products', cell: (row) => row.apply_all_product ? 'All products' : row.apply_products_raw || 'Selected products' },
        { header: 'States', cell: (row) => row.states_raw || 'No states mapped' },
        { header: 'Rates', cell: (row) => row.shipping_rate_raw || row.shipping_cod_rate_raw || 'No rate links' },
      ]}
      getRowKey={(row) => row.id}
      searchPlaceholder="Search zones, states, rates"
      emptyMessage="No shipping zones found."
      rowActions={(row) => (
        <div className="flex flex-wrap gap-2">
          <button className="polaris-button polaris-button-secondary" type="button" onClick={() => setEditing(row)}>
            <Pencil className="h-4 w-4" />
            Edit
          </button>
          <button
            className="polaris-button polaris-button-critical"
            type="button"
            onClick={async () => {
              if (!window.confirm(`Delete ${row.zone_name}?`)) return
              setBusy(true)
              try {
                await deleteZone({ data: { id: row.id } })
                setMessage('Shipping zone deleted.')
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
      )}
    >
      <AdminCrudPanel
        title={editing ? 'Edit shipping zone' : 'Create shipping zone'}
        description="Updates the shipping zone matrix fields preserved from Bubble."
        fields={[
          { name: 'zoneName', label: 'Zone name', required: true },
          { name: 'countryLegacyId', label: 'Country legacy ID' },
          { name: 'applyProductsRaw', label: 'Product links', type: 'textarea' },
          { name: 'statesRaw', label: 'State links', type: 'textarea' },
          { name: 'shippingRateRaw', label: 'Shipping rate links', type: 'textarea' },
          { name: 'shippingCodRateRaw', label: 'COD rate links', type: 'textarea' },
          { name: 'active', label: 'Active', type: 'checkbox' },
          { name: 'applyAllProduct', label: 'Apply all products', type: 'checkbox' },
        ]}
        initialValues={values}
        submitLabel={editing ? 'Save zone' : 'Create zone'}
        busy={busy}
        message={message}
        onCancel={() => setEditing(null)}
        onSubmit={async (formValues) => {
          setBusy(true)
          try {
            await saveZone({
              data: {
                id: typeof values.id === 'string' ? values.id : undefined,
                zoneName: String(formValues.zoneName ?? ''),
                active: Boolean(formValues.active),
                applyAllProduct: Boolean(formValues.applyAllProduct),
                countryLegacyId: String(formValues.countryLegacyId ?? ''),
                applyProductsRaw: String(formValues.applyProductsRaw ?? ''),
                statesRaw: String(formValues.statesRaw ?? ''),
                shippingRateRaw: String(formValues.shippingRateRaw ?? ''),
                shippingCodRateRaw: String(formValues.shippingCodRateRaw ?? ''),
              },
            })
            setEditing(null)
            setMessage('Shipping zone saved.')
            await router.invalidate()
          } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Save failed.')
          } finally {
            setBusy(false)
          }
        }}
      />
    </AdminModulePage>
  )
}
