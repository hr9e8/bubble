import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { listCustomers } from '../lib/customers.functions'
import { createOrder, listOrderCatalog } from '../lib/orders.functions'
import { formatMoney } from '../lib/utils'

export const Route = createFileRoute('/orders/new')({
  loader: async () => {
    const [customers, catalog] = await Promise.all([
      listCustomers({ data: { limit: 50 } }),
      listOrderCatalog(),
    ])
    return { customers, catalog }
  },
  component: NewOrderPage,
})

type CartItem = {
  productId: string
  name: string
  quantity: number
  unitPrice: number
}

function NewOrderPage() {
  const navigate = useNavigate()
  const { customers, catalog } = Route.useLoaderData()
  const createOrderFn = useServerFn(createOrder)
  const [orderNumber, setOrderNumber] = useState(`WEB-${Date.now()}`)
  const [customerId, setCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [selectedProductId, setSelectedProductId] = useState(catalog[0]?.id ?? '')
  const [cart, setCart] = useState<Array<CartItem>>([])
  const [shippingTotal, setShippingTotal] = useState(0)
  const [codFee, setCodFee] = useState(0)
  const [transactionFee, setTransactionFee] = useState(0)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer')
  const [proof, setProof] = useState<{ filename: string; contentType?: string; base64: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0), [cart])
  const total = Math.max(0, subtotal + shippingTotal + codFee + transactionFee - discountAmount)

  function addSelectedProduct() {
    const product = catalog.find((item) => item.id === selectedProductId)
    if (!product) return

    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id)
      if (existing) {
        return current.map((item) => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item)
      }

      return [...current, { productId: product.id, name: product.name, quantity: 1, unitPrice: Number(product.price_retail) }]
    })
  }

  async function readProof(file: File) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })

    setProof({
      filename: file.name,
      contentType: file.type,
      base64: dataUrl.split(',')[1] ?? '',
    })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const order = await createOrderFn({
        data: {
          orderNumber,
          customerId: customerId || undefined,
          customer: customerId ? undefined : {
            name: customerName,
            email: customerEmail || undefined,
            phone: customerPhone || undefined,
          },
          paymentMethod,
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
          shippingTotal,
          codFee,
          transactionFee,
          discountAmount,
          paymentProof: proof ? { ...proof, proofType: paymentMethod } : undefined,
        },
      })

      await navigate({ to: '/orders/$orderId', params: { orderId: order.id } })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to create order.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="app-page" onSubmit={handleSubmit}>
      <section className="page-header-row">
        <div>
          <h1 className="page-title">New order</h1>
          <p className="page-description">Create an order with customer details, cart totals, payment proof, and reserve stock movements.</p>
        </div>
        <button className="polaris-button polaris-button-primary" type="submit" disabled={isSubmitting || cart.length === 0 || (!customerId && !customerName)}>
          {isSubmitting ? 'Creating…' : 'Create order'}
        </button>
      </section>

      {error ? <p className="form-error">{error}</p> : null}

      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-4">
          <article className="section-card p-4">
            <h2 className="section-heading">Customer</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="form-field md:col-span-2">
                <span className="form-label">Existing customer</span>
                <select className="form-select" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                  <option value="">Create new customer</option>
                  {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} {customer.phone ? `(${customer.phone})` : ''}</option>)}
                </select>
              </label>
              {!customerId ? (
                <>
                  <input className="form-input" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Customer name" />
                  <input className="form-input" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="Phone" />
                  <input className="form-input md:col-span-2" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} placeholder="Email" />
                </>
              ) : null}
            </div>
          </article>

          <article className="section-card p-4">
            <h2 className="section-heading">Cart</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <select className="form-select min-w-[260px]" value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)}>
                {catalog.map((product) => <option key={product.id} value={product.id}>{product.name} · {formatMoney(Number(product.price_retail))}</option>)}
              </select>
              <button className="polaris-button polaris-button-secondary" type="button" onClick={addSelectedProduct}>
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {cart.map((item) => (
                <div key={item.productId} className="list-row grid gap-3 p-3 md:grid-cols-[1fr_90px_120px_40px] md:items-center">
                  <span className="text-sm font-semibold text-[#202223]">{item.name}</span>
                  <input className="form-input" type="number" min={1} value={item.quantity} onChange={(event) => setCart((current) => current.map((cartItem) => cartItem.productId === item.productId ? { ...cartItem, quantity: Number(event.target.value) } : cartItem))} />
                  <input className="form-input" type="number" min={0} step="0.01" value={item.unitPrice} onChange={(event) => setCart((current) => current.map((cartItem) => cartItem.productId === item.productId ? { ...cartItem, unitPrice: Number(event.target.value) } : cartItem))} />
                  <button className="polaris-button polaris-button-tertiary" type="button" aria-label="Remove item" onClick={() => setCart((current) => current.filter((cartItem) => cartItem.productId !== item.productId))}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </article>
        </div>

        <aside className="section-card p-4">
          <h2 className="section-heading">Totals and payment</h2>
          <div className="mt-4 grid gap-3">
            <input className="form-input" value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} placeholder="Order number" required />
            <select className="form-select" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
              <option value="bank_transfer">Bank transfer</option>
              <option value="cod">COD</option>
              <option value="cash">Cash</option>
            </select>
            <input className="form-input" type="number" min={0} step="0.01" value={shippingTotal} onChange={(event) => setShippingTotal(Number(event.target.value))} placeholder="Shipping" />
            <input className="form-input" type="number" min={0} step="0.01" value={codFee} onChange={(event) => setCodFee(Number(event.target.value))} placeholder="COD fee" />
            <input className="form-input" type="number" min={0} step="0.01" value={transactionFee} onChange={(event) => setTransactionFee(Number(event.target.value))} placeholder="Transaction fee" />
            <input className="form-input" type="number" min={0} step="0.01" value={discountAmount} onChange={(event) => setDiscountAmount(Number(event.target.value))} placeholder="Discount" />
            <input className="form-input" type="file" accept="image/*,.pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readProof(file) }} />
            <div className="list-row grid gap-2 p-3 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><strong>{formatMoney(subtotal)}</strong></div>
              <div className="flex justify-between"><span>Total</span><strong>{formatMoney(total)}</strong></div>
              {proof ? <p className="section-muted">Proof ready: {proof.filename}</p> : null}
            </div>
          </div>
        </aside>
      </section>
    </form>
  )
}
