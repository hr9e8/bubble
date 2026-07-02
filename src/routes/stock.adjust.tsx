import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { PencilLine } from 'lucide-react'
import { useState } from 'react'
import { createStockMovement, listStockFormOptions } from '../lib/stock.functions'

export const Route = createFileRoute('/stock/adjust')({
  loader: () => listStockFormOptions(),
  component: StockAdjustPage,
})

function StockAdjustPage() {
  const router = useRouter()
  const { products, users, warehouses } = Route.useLoaderData()
  const createMovement = useServerFn(createStockMovement)
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [userRelatedId, setUserRelatedId] = useState('')
  const [warehousePlatformId, setWarehousePlatformId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [reason, setReason] = useState('')
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
          movementType: 'warehouse_adjustment',
          productId,
          userRelatedId: userRelatedId || undefined,
          warehousePlatformId: warehousePlatformId || undefined,
          quantity,
          remark: reason || undefined,
        },
      })
      setMessage('Stock adjustment recorded.')
      setReason('')
      await router.invalidate()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to record adjustment.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="app-page" onSubmit={handleSubmit}>
      <section className="page-header-row">
        <div>
          <h1 className="page-title">Adjust stock</h1>
          <p className="page-description">Create signed correction movements with remarks and audit trail.</p>
        </div>
        <button className="polaris-button polaris-button-primary" type="submit" disabled={isSubmitting || !productId || quantity === 0 || !reason.trim()}>
          <PencilLine className="h-4 w-4" /> {isSubmitting ? 'Recording...' : 'Adjust stock'}
        </button>
      </section>

      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="form-help">{message}</p> : null}

      <section className="section-card p-4">
        <h2 className="section-heading">Correction details</h2>
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
            <span className="form-label">Owner user</span>
            <select className="form-select" value={userRelatedId} onChange={(event) => setUserRelatedId(event.target.value)}>
              <option value="">Current user / warehouse-level</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.name} · {user.email}</option>
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
            <span className="form-label">Signed quantity</span>
            <input className="form-input" type="number" step={1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} required />
            <span className="form-help">Use a positive number for gains and a negative number for losses.</span>
          </label>
          <label className="form-field md:col-span-2">
            <span className="form-label">Reason</span>
            <textarea className="form-textarea" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Cycle count variance, damaged stock, manual correction, or audit reference" required />
          </label>
        </div>
      </section>
    </form>
  )
}
