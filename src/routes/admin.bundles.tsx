import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { AdminCrudPanel } from '../components/admin-crud-panel'
import { AdminModulePage } from '../components/admin-module-page'
import { deleteAdminBundleLineItem, listAdminBundles, saveAdminBundleLineItem } from '../lib/admin.functions'
import { formatMoney } from '../lib/utils'

export const Route = createFileRoute('/admin/bundles')({
  loader: () => listAdminBundles(),
  component: AdminBundlesPage,
})

function AdminBundlesPage() {
  const router = useRouter()
  const { rows, stats, productOptions } = Route.useLoaderData()
  const saveBundle = useServerFn(saveAdminBundleLineItem)
  const deleteBundle = useServerFn(deleteAdminBundleLineItem)
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const values = {
    id: editing?.id,
    bundleProductId: editing?.bundle_product_id ?? '',
    childProductId: editing?.child_product_id ?? '',
    bundleProductCode: editing?.bundle_product_code ?? '',
    productCode: editing?.product_code ?? '',
    productCategory: editing?.product_category ?? '',
    quantity: editing?.quantity ?? 1,
    priceRetail: editing?.price_retail ?? '',
    priceDistributor: editing?.price_distributor ?? '',
  }
  const productSelectOptions = productOptions.map((product) => ({
    value: product.id,
    label: `${product.name}${product.sku_code ? ` (${product.sku_code})` : ''}`,
  }))

  return (
    <AdminModulePage
      title="Bundles"
      description="Build bundle products from child product line items with foreign-key traceability and Bubble fallback codes."
      badge="Catalog"
      primaryAction="New bundle"
      onPrimaryAction={() => setEditing(null)}
      metrics={[
        { label: 'Line items', value: stats.lineItems, detail: 'Bundle composition rows' },
        { label: 'Linked parents', value: stats.linkedParents, detail: 'Parent product FK matched' },
        { label: 'Linked children', value: stats.linkedChildren, detail: 'Child product FK matched' },
        { label: 'Fallback rows', value: stats.fallbackCodes, detail: 'Shown with Bubble codes' },
      ]}
      rows={rows}
      columns={[
        {
          header: 'Bundle',
          cell: (row) => (
            <div>
              <p className="font-semibold text-[#202223]">{row.bundle_product_name || row.bundle_product_code || 'No bundle code'}</p>
              <p className="mt-1 text-sm text-[#616161]">{row.bundle_product_code || 'No legacy code'}</p>
            </div>
          ),
        },
        { header: 'Child product', cell: (row) => row.child_product_name || row.product_code || 'No child product' },
        { header: 'Category', cell: (row) => row.product_category || 'Uncategorized' },
        { header: 'Qty', cell: (row) => row.quantity ?? 0 },
        {
          header: 'Prices',
          cell: (row) => (
            <div className="text-sm">
              <p>{formatMoney(Number(row.price_retail || 0))} retail</p>
              <p className="mt-1 text-[#616161]">{formatMoney(Number(row.price_distributor || 0))} distributor</p>
            </div>
          ),
        },
      ]}
      getRowKey={(row) => row.id}
      searchPlaceholder="Search bundle or child product"
      emptyMessage="No bundle line items found."
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
              if (!window.confirm('Delete this bundle line item?')) return
              setBusy(true)
              try {
                await deleteBundle({ data: { id: row.id } })
                setMessage('Bundle line deleted.')
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
        title={editing ? 'Edit bundle line' : 'Create bundle line'}
        description="Link bundle parent products to child products while retaining legacy Bubble codes."
        fields={[
          { name: 'bundleProductId', label: 'Bundle product', type: 'select', options: productSelectOptions },
          { name: 'childProductId', label: 'Child product', type: 'select', options: productSelectOptions },
          { name: 'bundleProductCode', label: 'Legacy bundle code' },
          { name: 'productCode', label: 'Legacy child code' },
          { name: 'productCategory', label: 'Category' },
          { name: 'quantity', label: 'Quantity', type: 'number', step: '1', min: 0 },
          { name: 'priceRetail', label: 'Retail price', type: 'number', step: '0.01', min: 0 },
          { name: 'priceDistributor', label: 'Distributor price', type: 'number', step: '0.01', min: 0 },
        ]}
        initialValues={values}
        submitLabel={editing ? 'Save bundle line' : 'Create bundle line'}
        busy={busy}
        message={message}
        onCancel={() => setEditing(null)}
        onSubmit={async (formValues) => {
          setBusy(true)
          try {
            await saveBundle({
              data: {
                id: typeof values.id === 'string' ? values.id : undefined,
                bundleProductId: String(formValues.bundleProductId ?? ''),
                childProductId: String(formValues.childProductId ?? ''),
                bundleProductCode: String(formValues.bundleProductCode ?? ''),
                productCode: String(formValues.productCode ?? ''),
                productCategory: String(formValues.productCategory ?? ''),
                quantity: formValues.quantity === '' ? null : Number(formValues.quantity || 0),
                priceRetail: formValues.priceRetail === '' ? null : Number(formValues.priceRetail || 0),
                priceDistributor: formValues.priceDistributor === '' ? null : Number(formValues.priceDistributor || 0),
              },
            })
            setEditing(null)
            setMessage('Bundle line saved.')
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
