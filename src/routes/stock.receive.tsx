import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { PackagePlus } from 'lucide-react'
import { useState } from 'react'
import { createStockMovement, listStockFormOptions } from '../lib/stock.functions'

export const Route = createFileRoute('/stock/receive')({
  loader: () => listStockFormOptions(),
  component: StockReceivePage,
})

function StockReceivePage() {
  const router = useRouter()
  const { products, warehouses } = Route.useLoaderData()
  const createMovement = useServerFn(createStockMovement)
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [warehousePlatformId, setWarehousePlatformId] = useState(warehouses[0]?.id ?? '')
  const [quantity, setQuantity] = useState(1)
  const [reference, setReference] = useState('')
  const [remark, setRemark] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    try {
      await createMovement({
        data: {
          movementType: 'warehouse_receive',
          productId,
          warehousePlatformId: warehousePlatformId || undefined,
          quantity,
          remark: [reference, remark].filter(Boolean).join(' - ') || undefined,
        },
      })
      setMessage('Warehouse receipt recorded.')
      setReference('')
      setRemark('')
      await router.invalidate()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to record receipt.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="app-page" onSubmit={handleSubmit}>
      <section className="page-header-row">
        <div>
          <h1 className="page-title">Receive stock</h1>
          <p className="page-description">Record inbound warehouse quantities as auditable positive ledger movements.</p>
        </div>
        <button className="polaris-button polaris-button-primary" type="submit" disabled={isSubmitting || !productId || quantity <= 0}>
          <PackagePlus className="h-4 w-4" /> {isSubmitting ? 'Recording...' : 'Receive stock'}
        </button>
      </section>

      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="form-help">{message}</p> : null}

      <section className="section-card p-4">
        <h2 className="section-heading">Inbound details</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="form-field md:col-span-2">
            <span className="form-label">Product</span>
            <select className="form-select" value={productId} onChange={(event) => setProductId(event.target.value)} required>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.name}{product.sku_code ? ` · ${product.sku_code}` : ''}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span className="form-label">Warehouse platform</span>
            <select className="form-select" value={warehousePlatformId} onChange={(event) => setWarehousePlatformId(event.target.value)}>
              <option value="">No warehouse platform</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>{warehouse.name}{warehouse.order_prefix ? ` · ${warehouse.order_prefix}` : ''}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span className="form-label">Quantity received</span>
            <input className="form-input" type="number" min={1} step={1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} required />
          </label>
          <label className="form-field">
            <span className="form-label">Reference</span>
            <input className="form-input" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="DO, inbound, or shipment number" />
          </label>
          <label className="form-field md:col-span-2">
            <span className="form-label">Remark</span>
            <textarea className="form-textarea" value={remark} onChange={(event) => setRemark(event.target.value)} placeholder="Location, lot notes, or receiving remarks" />
          </label>
        </div>
      </section>
    </form>
  )
}
