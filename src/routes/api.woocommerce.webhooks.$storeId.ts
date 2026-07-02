import { createFileRoute } from '@tanstack/react-router'
import { processWooCommerceWebhook } from '../lib/woocommerce.functions'

export const Route = createFileRoute('/api/woocommerce/webhooks/$storeId')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const rawBody = await request.text()
        const payload = rawBody ? JSON.parse(rawBody) : null
        const topic = request.headers.get('x-wc-webhook-topic') ?? getWrappedHeader(payload, 'x-wc-webhook-topic') ?? 'order.updated'
        const deliveryId = request.headers.get('x-wc-webhook-delivery-id') ?? getWrappedHeader(payload, 'x-wc-webhook-delivery-id')
        const signature = request.headers.get('x-wc-webhook-signature') ?? getWrappedHeader(payload, 'x-wc-webhook-signature')
        const signedBody = getWrappedRawBody(payload) ?? rawBody

        const result = await processWooCommerceWebhook({
          storeId: params.storeId,
          topic,
          deliveryId,
          signature,
          payload,
          rawBody: signedBody,
        })

        return Response.json({ ok: true, eventId: result.event.id, order: result.order })
      },
    },
  },
})

function getWrappedHeader(payload: unknown, name: string) {
  if (!Array.isArray(payload)) return null
  const first = payload[0]
  if (typeof first !== 'object' || !first || !('headers' in first)) return null
  const headers = first.headers
  if (typeof headers !== 'object' || !headers) return null
  const value = (headers as Record<string, unknown>)[name]
  return typeof value === 'string' ? value : null
}

function getWrappedRawBody(payload: unknown) {
  if (!Array.isArray(payload)) return null
  const first = payload[0]
  if (typeof first !== 'object' || !first || !('body' in first)) return null
  const body = first.body
  return typeof body === 'string' ? body : JSON.stringify(body)
}
