import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { Badge } from '../components/ui/badge'
import { connectWooCommerceStore, listWooCommerceStores, queueWooCommerceSync, removeWooCommerceStore, runWooCommerceSync, testWooCommerceStore } from '../lib/woocommerce.functions'

export const Route = createFileRoute('/admin/woocommerce')({
  loader: () => listWooCommerceStores(),
  component: AdminWooCommercePage,
})

function AdminWooCommercePage() {
  const router = useRouter()
  const stores = Route.useLoaderData()
  const connectStore = useServerFn(connectWooCommerceStore)
  const testStore = useServerFn(testWooCommerceStore)
  const queueSync = useServerFn(queueWooCommerceSync)
  const runSync = useServerFn(runWooCommerceSync)
  const removeStore = useServerFn(removeWooCommerceStore)
  const [name, setName] = useState('')
  const [storeUrl, setStoreUrl] = useState('')
  const [consumerKeySecretRef, setConsumerKeySecretRef] = useState('')
  const [consumerSecretSecretRef, setConsumerSecretSecretRef] = useState('')
  const [webhookSecretSecretRef, setWebhookSecretSecretRef] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)

  async function withBusy(action: string, callback: () => Promise<void>) {
    setBusyAction(action)
    setMessage(null)
    try {
      await callback()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div className="app-page">
      <section className="page-header">
        <h1 className="page-title">WooCommerce</h1>
        <p className="page-description">Connect stores, test reachability, queue idempotent imports, and retain manual finance or warehouse decisions.</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <form
          className="section-card grid gap-3 p-4"
          onSubmit={async (event) => {
            event.preventDefault()
            await withBusy('connect', async () => {
              await connectStore({ data: { name, storeUrl, consumerKeySecretRef, consumerSecretSecretRef, webhookSecretSecretRef } })
              setName('')
              setStoreUrl('')
              setConsumerKeySecretRef('')
              setConsumerSecretSecretRef('')
              setWebhookSecretSecretRef('')
              setMessage('Store connected.')
              await router.invalidate()
            })
          }}
        >
          <h2 className="section-heading">Connect store</h2>
          <p className="section-muted">Use env:NAME references in production. Pasted secrets are encrypted when WOOCOMMERCE_CREDENTIAL_KEY is configured.</p>
          <input className="form-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Store name" required />
          <input className="form-input" value={storeUrl} onChange={(event) => setStoreUrl(event.target.value)} placeholder="https://store.example" required />
          <input className="form-input" value={consumerKeySecretRef} onChange={(event) => setConsumerKeySecretRef(event.target.value)} placeholder="env:WOO_STORE_KEY or consumer key" required />
          <input className="form-input" type="password" value={consumerSecretSecretRef} onChange={(event) => setConsumerSecretSecretRef(event.target.value)} placeholder="env:WOO_STORE_SECRET or consumer secret" required />
          <input className="form-input" type="password" value={webhookSecretSecretRef} onChange={(event) => setWebhookSecretSecretRef(event.target.value)} placeholder="env:WOO_WEBHOOK_SECRET or webhook secret" required />
          <button className="polaris-button polaris-button-primary" type="submit" disabled={busyAction === 'connect'}>{busyAction === 'connect' ? 'Connecting' : 'Connect'}</button>
          {message ? <p className="section-muted">{message}</p> : null}
        </form>

        <section className="section-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="section-heading">Stores</h2>
            <button
              className="polaris-button polaris-button-secondary"
              type="button"
              disabled={busyAction === 'run-all'}
              onClick={() => withBusy('run-all', async () => {
                const result = await runSync({ data: { limit: 3 } })
                setMessage(`Processed ${result.processed} queued sync job${result.processed === 1 ? '' : 's'}.`)
                await router.invalidate()
              })}
            >
              Run queue
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {stores.map((store) => (
              <div key={store.id} className="list-row grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[#202223]">{store.name}</p>
                    <Badge tone={statusTone(store.sync_status)}>{store.sync_status}</Badge>
                    {store.open_job_count ? <Badge tone="warning">{store.open_job_count} open</Badge> : null}
                  </div>
                  <p className="section-muted mt-1 break-all text-xs">{store.store_url}</p>
                  <dl className="mt-3 grid gap-2 text-xs text-[#616161] sm:grid-cols-2 xl:grid-cols-3">
                    <Info label="Orders" value={String(store.imported_order_count ?? 0)} />
                    <Info label="Last sync" value={formatDate(store.last_synced_at)} />
                    <Info label="Last job" value={[store.latest_job_status, formatDate(store.latest_job_created_at)].filter(Boolean).join(' · ') || 'None'} />
                    <Info label="Webhook" value={[store.latest_webhook_status, formatDate(store.latest_webhook_created_at)].filter(Boolean).join(' · ') || 'None'} />
                    <Info label="API key" value={store.consumer_key_secret_ref} />
                    <Info label="Webhook secret" value={store.webhook_secret_secret_ref} />
                  </dl>
                  {store.latest_webhook_error ? <p className="mt-2 text-xs font-semibold text-[#d72c0d]">{store.latest_webhook_error}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="polaris-button polaris-button-secondary"
                    disabled={busyAction === `test-${store.id}`}
                    onClick={() => withBusy(`test-${store.id}`, async () => {
                      const result = await testStore({ data: { storeId: store.id } })
                      setMessage(`Test ${result.ok ? 'passed' : 'failed'} (${result.status || 'network error'})${result.error ? `: ${result.error}` : ''}`)
                      await router.invalidate()
                    })}
                  >
                    Test
                  </button>
                  <button className="polaris-button polaris-button-primary" disabled={busyAction === `queue-${store.id}`} onClick={() => withBusy(`queue-${store.id}`, async () => { await queueSync({ data: { storeId: store.id } }); setMessage('Sync queued.'); await router.invalidate() })}>Queue import</button>
                  <button className="polaris-button polaris-button-secondary" disabled={busyAction === `run-${store.id}`} onClick={() => withBusy(`run-${store.id}`, async () => {
                    const result = await runSync({ data: { storeId: store.id, limit: 1 } })
                    const failed = result.results.find((item) => item.status === 'failed')
                    setMessage(failed ? `Sync failed: ${failed.error}` : `Processed ${result.processed} sync job${result.processed === 1 ? '' : 's'}.`)
                    await router.invalidate()
                  })}>Run sync</button>
                  <button
                    className="polaris-button polaris-button-secondary"
                    disabled={busyAction === `remove-${store.id}`}
                    onClick={() => withBusy(`remove-${store.id}`, async () => {
                      if (!window.confirm(`Remove ${store.name}? Imported orders will keep their WooCommerce order IDs but no longer point to this store.`)) return
                      const result = await removeStore({ data: { storeId: store.id } })
                      setMessage(`Store removed.${result.unlinkedOrders ? ` Unlinked ${result.unlinkedOrders} imported order${result.unlinkedOrders === 1 ? '' : 's'}.` : ''}`)
                      await router.invalidate()
                    })}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <dt className="font-semibold text-[#303030]">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  )
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return 'Never'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function statusTone(status: string) {
  if (status.includes('fail')) return 'danger'
  if (status === 'synced' || status === 'test_ok') return 'success'
  if (status === 'connected') return 'info'
  return 'neutral'
}
