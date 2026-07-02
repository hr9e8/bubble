import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { ArrowRightLeft } from 'lucide-react'
import { useState } from 'react'
import { createLeaderStockTransfer, listStockFormOptions } from '../lib/stock.functions'

export const Route = createFileRoute('/stock/transfer')({
  loader: () => listStockFormOptions(),
  component: StockTransferPage,
})

function StockTransferPage() {
  const router = useRouter()
  const { products, users, currentUserId } = Route.useLoaderData()
  const createTransfer = useServerFn(createLeaderStockTransfer)
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [fromUserId, setFromUserId] = useState(users.find((user) => user.id === currentUserId)?.id ?? users[0]?.id ?? '')
  const [toUserId, setToUserId] = useState(users.find((user) => user.id !== fromUserId)?.id ?? '')
  const [quantity, setQuantity] = useState(1)
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
      await createTransfer({
        data: {
          productId,
          fromUserId,
          toUserId,
          quantity,
          remark: remark || undefined,
        },
      })
      setMessage('Transfer recorded.')
      setRemark('')
      await router.invalidate()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to record transfer.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="app-page" onSubmit={handleSubmit}>
      <section className="page-header-row">
        <div>
          <h1 className="page-title">Transfer stock</h1>
          <p className="page-description">Move stock between assigned sales users through paired out/in ledger movements.</p>
        </div>
        <button className="polaris-button polaris-button-primary" type="submit" disabled={isSubmitting || !productId || !fromUserId || !toUserId || fromUserId === toUserId}>
          <ArrowRightLeft className="h-4 w-4" /> {isSubmitting ? 'Recording...' : 'Create transfer'}
        </button>
      </section>

      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="form-help">{message}</p> : null}

      <section className="section-card p-4">
        <h2 className="section-heading">Transfer details</h2>
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
            <span className="form-label">Source user</span>
            <select className="form-select" value={fromUserId} onChange={(event) => setFromUserId(event.target.value)} required>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.name} · {user.email}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span className="form-label">Destination user</span>
            <select className="form-select" value={toUserId} onChange={(event) => setToUserId(event.target.value)} required>
              <option value="">Select destination</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.name} · {user.email}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span className="form-label">Quantity</span>
            <input className="form-input" type="number" min={1} step={1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} required />
          </label>
          <label className="form-field md:col-span-2">
            <span className="form-label">Remark</span>
            <textarea className="form-textarea" value={remark} onChange={(event) => setRemark(event.target.value)} placeholder="Reason, request reference, or operational note" />
          </label>
        </div>
      </section>
    </form>
  )
}
