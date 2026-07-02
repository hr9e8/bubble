import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { sql } from 'kysely'
import { z } from 'zod'

const connectStoreInput = z.object({
  platformId: z.string().uuid().optional(),
  name: z.string().min(1),
  storeUrl: z.string().url(),
  consumerKeySecretRef: z.string().min(1),
  consumerSecretSecretRef: z.string().min(1),
  webhookSecretSecretRef: z.string().min(1),
  platform: z.string().optional(),
  orderPrefix: z.string().optional(),
})

const storeIdInput = z.object({ storeId: z.string().uuid() })
const runSyncInput = z.object({ storeId: z.string().uuid().optional(), limit: z.number().int().min(1).max(10).optional() }).optional()

function normalizeStoreUrl(storeUrl: string) {
  const url = new URL(storeUrl)
  url.pathname = url.pathname.replace(/\/+$/, '')
  url.search = ''
  url.hash = ''
  return url.toString().replace(/\/$/, '')
}

const getCrypto = createServerOnlyFn(async () => import('node:crypto'))

async function getCredentialKey() {
  const { createHash } = await getCrypto()
  const secret = process.env.WOOCOMMERCE_CREDENTIAL_KEY ?? process.env.APP_SECRET ?? process.env.BETTER_AUTH_SECRET
  if (!secret) return null
  return createHash('sha256').update(secret).digest()
}

async function encryptSecretValue(value: string) {
  const { createCipheriv, randomBytes } = await getCrypto()
  const key = await getCredentialKey()
  if (!key) {
    throw new Error('Set WOOCOMMERCE_CREDENTIAL_KEY or pass an env:NAME credential reference before saving raw WooCommerce secrets.')
  }

  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `enc:v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${ciphertext.toString('base64url')}`
}

async function decryptSecretValue(secretRef: string) {
  const { createDecipheriv } = await getCrypto()
  const [, version, ivValue, tagValue, ciphertextValue] = secretRef.split(':')
  if (version !== 'v1' || !ivValue || !tagValue || !ciphertextValue) {
    throw new Error('Unsupported encrypted WooCommerce credential format.')
  }

  const key = await getCredentialKey()
  if (!key) throw new Error('WOOCOMMERCE_CREDENTIAL_KEY is required to read encrypted WooCommerce credentials.')

  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivValue, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

async function normalizeSecretRef(value: string) {
  const trimmed = value.trim()
  if (!trimmed) throw new Error('Credential reference cannot be empty.')
  if (trimmed.startsWith('env:') || trimmed.startsWith('enc:')) return trimmed
  if (process.env[trimmed] || /^[A-Z][A-Z0-9_]*$/.test(trimmed)) return `env:${trimmed}`
  return encryptSecretValue(trimmed)
}

async function resolveSecretValue(secretRef: string | null | undefined) {
  if (!secretRef) return null
  if (secretRef.startsWith('env:')) {
    const envName = secretRef.slice(4)
    const value = process.env[envName]
    if (!value) throw new Error(`Missing WooCommerce credential environment variable: ${envName}`)
    return value
  }
  if (secretRef.startsWith('enc:')) return decryptSecretValue(secretRef)
  return process.env[secretRef] ?? secretRef
}

function maskSecretRef(secretRef: string | null) {
  if (!secretRef) return 'Not configured'
  if (secretRef.startsWith('env:')) return secretRef
  if (secretRef.startsWith('enc:')) return 'Encrypted'
  return process.env[secretRef] ? `env:${secretRef}` : 'Legacy plaintext'
}

const wooOrderInput = z.object({
  storeId: z.string().uuid(),
  order: z.object({
    id: z.union([z.string(), z.number()]),
    number: z.string().optional(),
    status: z.string().optional(),
    currency: z.string().optional(),
    subtotal: z.union([z.string(), z.number()]).optional(),
    discount_total: z.union([z.string(), z.number()]).optional(),
    shipping_total: z.union([z.string(), z.number()]).optional(),
    total: z.union([z.string(), z.number()]).optional(),
    payment_method: z.string().optional(),
    transaction_id: z.string().optional(),
    date_created: z.string().optional(),
    date_modified: z.string().optional(),
    billing: z
      .object({
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        address_1: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        postcode: z.string().optional(),
      })
      .optional(),
    shipping: z
      .object({
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        phone: z.string().optional(),
        address_1: z.string().optional(),
        address_2: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        postcode: z.string().optional(),
      })
      .optional(),
    meta_data: z
      .array(
        z.object({
          key: z.string().optional(),
          value: z.unknown().optional(),
        }),
      )
      .optional(),
    line_items: z
      .array(
        z.object({
          name: z.string().optional(),
          sku: z.string().optional(),
          quantity: z.union([z.string(), z.number()]).optional(),
          price: z.union([z.string(), z.number()]).optional(),
          total: z.union([z.string(), z.number()]).optional(),
        }),
      )
      .optional(),
  }),
})

const getServerDeps = createServerOnlyFn(async () => {
  const [db, authContext] = await Promise.all([
    import('./db/client'),
    import('./server/auth-context'),
  ])

  return { ...db, ...authContext }
})

export const listWooCommerceStores = createServerFn({ method: 'GET' }).handler(async () => {
  const { getDatabase, requireCurrentUser } = await getServerDeps()
  await requireCurrentUser({ permissions: ['woocommerce:manage'] })
  const db = getDatabase()

  const stores = await db
    .selectFrom('woocommerce_stores')
    .leftJoin('sales_team_platforms', 'sales_team_platforms.id', 'woocommerce_stores.platform_id')
    .select([
      'woocommerce_stores.id',
      'woocommerce_stores.name',
      'woocommerce_stores.store_url',
      'woocommerce_stores.sync_status',
      'woocommerce_stores.last_synced_at',
      'woocommerce_stores.consumer_key_secret_ref',
      'woocommerce_stores.consumer_secret_secret_ref',
      'woocommerce_stores.webhook_secret_secret_ref',
      'sales_team_platforms.name as platform_name',
      sql<number>`(
        select count(*)::int from orders
        where orders.woo_store_id = woocommerce_stores.id
      )`.as('imported_order_count'),
      sql<string | null>`(
        select status from woocommerce_sync_jobs
        where woocommerce_sync_jobs.store_id = woocommerce_stores.id
        order by created_at desc
        limit 1
      )`.as('latest_job_status'),
      sql<Date | null>`(
        select created_at from woocommerce_sync_jobs
        where woocommerce_sync_jobs.store_id = woocommerce_stores.id
        order by created_at desc
        limit 1
      )`.as('latest_job_created_at'),
      sql<number>`(
        select count(*)::int from woocommerce_sync_jobs
        where woocommerce_sync_jobs.store_id = woocommerce_stores.id
          and woocommerce_sync_jobs.status in ('queued', 'running')
      )`.as('open_job_count'),
      sql<string | null>`(
        select status from woocommerce_webhook_events
        where woocommerce_webhook_events.store_id = woocommerce_stores.id
        order by created_at desc
        limit 1
      )`.as('latest_webhook_status'),
      sql<Date | null>`(
        select created_at from woocommerce_webhook_events
        where woocommerce_webhook_events.store_id = woocommerce_stores.id
        order by created_at desc
        limit 1
      )`.as('latest_webhook_created_at'),
      sql<string | null>`(
        select error_message from woocommerce_webhook_events
        where woocommerce_webhook_events.store_id = woocommerce_stores.id
          and error_message is not null
        order by created_at desc
        limit 1
      )`.as('latest_webhook_error'),
    ])
    .orderBy('woocommerce_stores.created_at', 'desc')
    .execute()

  return stores.map((store) => ({
    ...store,
    consumer_key_secret_ref: maskSecretRef(store.consumer_key_secret_ref),
    consumer_secret_secret_ref: maskSecretRef(store.consumer_secret_secret_ref),
    webhook_secret_secret_ref: maskSecretRef(store.webhook_secret_secret_ref),
  }))
})

export const connectWooCommerceStore = createServerFn({ method: 'POST' })
  .validator(connectStoreInput)
  .handler(async ({ data }) => {
    const { getDatabase, requireCurrentUser, writeAuditLog } = await getServerDeps()
    const user = await requireCurrentUser({ permissions: ['woocommerce:manage'] })
    const [consumerKeySecretRef, consumerSecretSecretRef, webhookSecretSecretRef] = await Promise.all([
      normalizeSecretRef(data.consumerKeySecretRef),
      normalizeSecretRef(data.consumerSecretSecretRef),
      normalizeSecretRef(data.webhookSecretSecretRef),
    ])

    const store = await getDatabase()
      .insertInto('woocommerce_stores')
      .values({
        platform_id: data.platformId ?? null,
        name: data.name,
        store_url: normalizeStoreUrl(data.storeUrl),
        consumer_key_secret_ref: consumerKeySecretRef,
        consumer_secret_secret_ref: consumerSecretSecretRef,
        webhook_secret_secret_ref: webhookSecretSecretRef,
        platform: data.platform ?? null,
        order_prefix: data.orderPrefix ?? null,
        sync_status: 'connected',
        created_by_user_id: user.id,
      })
      .returning(['id', 'name', 'store_url', 'sync_status'])
      .executeTakeFirstOrThrow()

    await writeAuditLog({ actorUserId: user.id, action: 'woocommerce.store.connect', entityTable: 'woocommerce_stores', entityId: store.id, afterData: store })
    return store
  })

export const queueWooCommerceSync = createServerFn({ method: 'POST' })
  .validator(storeIdInput)
  .handler(async ({ data }) => {
    const { getDatabase, requireCurrentUser, writeAuditLog } = await getServerDeps()
    const user = await requireCurrentUser({ permissions: ['woocommerce:manage'] })

    const job = await getDatabase()
      .insertInto('woocommerce_sync_jobs')
      .values({
        store_id: data.storeId,
        job_type: 'orders_import',
        status: 'queued',
        created_by_user_id: user.id,
      })
      .returning(['id', 'store_id', 'status'])
      .executeTakeFirstOrThrow()

    await writeAuditLog({ actorUserId: user.id, action: 'woocommerce.sync.queue', entityTable: 'woocommerce_sync_jobs', entityId: job.id, afterData: job })
    return job
  })

export const runWooCommerceSync = createServerFn({ method: 'POST' })
  .validator(runSyncInput)
  .handler(async ({ data }) => {
    const { requireCurrentUser } = await getServerDeps()
    await requireCurrentUser({ permissions: ['woocommerce:manage'] })
    return processWooCommerceSyncJobs({ storeId: data?.storeId, limit: data?.limit ?? 1 })
  })

export const testWooCommerceStore = createServerFn({ method: 'POST' })
  .validator(storeIdInput)
  .handler(async ({ data }) => {
    const { getDatabase, requireCurrentUser, writeAuditLog } = await getServerDeps()
    const user = await requireCurrentUser({ permissions: ['woocommerce:manage'] })
    const store = await getDatabase()
      .selectFrom('woocommerce_stores')
      .select(['id', 'store_url', 'consumer_key_secret_ref', 'consumer_secret_secret_ref'])
      .where('id', '=', data.storeId)
      .executeTakeFirstOrThrow()

    const url = new URL('/wp-json/wc/v3/system_status', store.store_url)
    const [consumerKey, consumerSecret] = await Promise.all([
      resolveSecretValue(store.consumer_key_secret_ref),
      resolveSecretValue(store.consumer_secret_secret_ref),
    ])
    url.searchParams.set('consumer_key', consumerKey ?? '')
    url.searchParams.set('consumer_secret', consumerSecret ?? '')

    let ok = false
    let status = 0
    let error: string | undefined

    try {
      const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } })
      ok = response.ok
      status = response.status
      if (!response.ok) {
        error = (await response.text()).slice(0, 500)
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Connection failed'
    }

    await getDatabase()
      .updateTable('woocommerce_stores')
      .set({ sync_status: ok ? 'test_ok' : 'test_failed', updated_at: new Date() })
      .where('id', '=', data.storeId)
      .execute()

    await writeAuditLog({ actorUserId: user.id, action: 'woocommerce.store.test', entityTable: 'woocommerce_stores', entityId: data.storeId, metadata: { ok, status, error } })
    return { ok, status, error }
  })

export const removeWooCommerceStore = createServerFn({ method: 'POST' })
  .validator(storeIdInput)
  .handler(async ({ data }) => {
    const { getDatabase, requireCurrentUser, writeAuditLog } = await getServerDeps()
    const user = await requireCurrentUser({ permissions: ['woocommerce:manage'] })

    const store = await getDatabase()
      .selectFrom('woocommerce_stores')
      .select(['id', 'name', 'store_url', 'sync_status'])
      .where('id', '=', data.storeId)
      .executeTakeFirstOrThrow()

    const result = await getDatabase().transaction().execute(async (trx) => {
      const unlinkedOrders = await trx
        .updateTable('orders')
        .set({ woo_store_id: null, updated_at: new Date() })
        .where('woo_store_id', '=', data.storeId)
        .executeTakeFirst()

      await trx.deleteFrom('woocommerce_stores').where('id', '=', data.storeId).execute()

      return { unlinkedOrders: Number(unlinkedOrders.numUpdatedRows) }
    })

    await writeAuditLog({
      actorUserId: user.id,
      action: 'woocommerce.store.remove',
      entityTable: 'woocommerce_stores',
      entityId: data.storeId,
      beforeData: store,
      metadata: result,
    })

    return { ok: true, ...result }
  })

export const importWooCommerceOrder = createServerFn({ method: 'POST' })
  .validator(wooOrderInput)
  .handler(async ({ data }) => {
    const { requireCurrentUser } = await getServerDeps()
    const user = await requireCurrentUser({ permissions: ['woocommerce:manage'] })
    return importWooOrder(data.storeId, data.order, user.id)
  })

export async function recordWooCommerceWebhook(input: {
  storeId: string
  topic: string
  deliveryId?: string | null
  wooOrderId?: string | null
  signature?: string | null
  payload: unknown
}) {
  const { getDatabase } = await getServerDeps()
  const existing = input.deliveryId
    ? await getDatabase()
      .selectFrom('woocommerce_webhook_events')
      .select(['id', 'status'])
      .where('store_id', '=', input.storeId)
      .where('delivery_id', '=', input.deliveryId)
      .executeTakeFirst()
    : null

  if (existing) return { ...existing, store_id: input.storeId, event_topic: input.topic, woo_order_id: input.wooOrderId ?? null }

  return getDatabase()
    .insertInto('woocommerce_webhook_events')
    .values({
      store_id: input.storeId,
      event_topic: input.topic,
      delivery_id: input.deliveryId ?? null,
      woo_order_id: input.wooOrderId ?? null,
      signature: input.signature ?? null,
      payload: JSON.stringify(input.payload),
      status: 'received',
    })
    .onConflict((oc) =>
      oc.columns(['store_id', 'delivery_id']).doUpdateSet({
        payload: JSON.stringify(input.payload),
        signature: input.signature ?? null,
        status: 'received',
        error_message: null,
      }),
    )
    .returning(['id', 'store_id', 'event_topic', 'woo_order_id', 'status'])
    .executeTakeFirstOrThrow()
}

export async function processWooCommerceWebhook(input: {
  storeId: string
  topic: string
  deliveryId?: string | null
  signature?: string | null
  payload: unknown
  rawBody?: string
}) {
  const orderPayload = getWooOrderPayload(input.payload)
  const wooOrderId = orderPayload ? String(orderPayload.id) : null

  const event = await recordWooCommerceWebhook({
    ...input,
    wooOrderId,
  })

  try {
    await verifyWooCommerceWebhookSignature(input.storeId, input.signature, input.rawBody)
  } catch (error) {
    await markWebhookFailed(event.id, error)
    throw error
  }

  if (!orderPayload || !input.topic.startsWith('order.')) {
    return { event, order: null }
  }

  let order: Awaited<ReturnType<typeof importWooOrder>>
  try {
    order = await importWooOrder(input.storeId, orderPayload, null)
  } catch (error) {
    await markWebhookFailed(event.id, error)
    throw error
  }

  await markWebhookProcessed(event.id)

  return { event, order }
}

async function verifyWooCommerceWebhookSignature(storeId: string, signature: string | null | undefined, rawBody: string | undefined) {
  if (!signature) throw new Error('Missing WooCommerce webhook signature.')
  if (!rawBody) throw new Error('Missing raw WooCommerce webhook body for signature verification.')

  const { getDatabase } = await getServerDeps()
  const store = await getDatabase()
    .selectFrom('woocommerce_stores')
    .select(['webhook_secret_secret_ref'])
    .where('id', '=', storeId)
    .executeTakeFirstOrThrow()

  const webhookSecret = await resolveSecretValue(store.webhook_secret_secret_ref)
  if (!webhookSecret) throw new Error('WooCommerce webhook secret is not configured for this store.')

  const { createHmac, timingSafeEqual } = await getCrypto()
  const expected = createHmac('sha256', webhookSecret).update(rawBody, 'utf8').digest('base64')
  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(signature)
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw new Error('Invalid WooCommerce webhook signature.')
  }
}

async function fetchWooCommerceOrders(store: {
  store_url: string
  consumer_key_secret_ref: string
  consumer_secret_secret_ref: string
  last_synced_at: Date | null
}) {
  const orders: Array<z.infer<typeof wooOrderInput>['order']> = []
  const [consumerKey, consumerSecret] = await Promise.all([
    resolveSecretValue(store.consumer_key_secret_ref),
    resolveSecretValue(store.consumer_secret_secret_ref),
  ])
  if (!consumerKey || !consumerSecret) throw new Error('WooCommerce API credentials are not configured.')

  for (let page = 1; page <= 10; page += 1) {
    const url = new URL('/wp-json/wc/v3/orders', store.store_url)
    url.searchParams.set('consumer_key', consumerKey)
    url.searchParams.set('consumer_secret', consumerSecret)
    url.searchParams.set('per_page', '100')
    url.searchParams.set('page', String(page))
    url.searchParams.set('orderby', 'modified')
    url.searchParams.set('order', 'asc')
    if (store.last_synced_at) url.searchParams.set('after', store.last_synced_at.toISOString())

    const response = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!response.ok) {
      throw new Error(`WooCommerce order sync failed with ${response.status}: ${(await response.text()).slice(0, 500)}`)
    }

    const payload = await response.json()
    if (!Array.isArray(payload) || payload.length === 0) break

    for (const item of payload) {
      const parsed = wooOrderInput.shape.order.safeParse(item)
      if (parsed.success) orders.push(parsed.data)
    }

    if (payload.length < 100) break
  }

  return orders
}

export async function processWooCommerceSyncJobs(input: { storeId?: string; limit?: number } = {}) {
  const { getDatabase } = await getServerDeps()
  const db = getDatabase()
  const limit = input.limit ?? 1
  const results: Array<{ jobId: string; storeId: string; status: string; importedOrders: number; error?: string }> = []

  for (let index = 0; index < limit; index += 1) {
    const job = await db.transaction().execute(async (trx) => {
      const nextJob = await trx
        .selectFrom('woocommerce_sync_jobs')
        .select(['id'])
        .where('status', '=', 'queued')
        .$if(Boolean(input.storeId), (qb) => qb.where('store_id', '=', input.storeId!))
        .orderBy('created_at', 'asc')
        .executeTakeFirst()

      if (!nextJob) return null

      return trx
        .updateTable('woocommerce_sync_jobs')
        .set({ status: 'running', started_at: new Date(), error_message: null })
        .where('id', '=', nextJob.id)
        .where('status', '=', 'queued')
        .returning(['id', 'store_id'])
        .executeTakeFirst()
    })

    if (!job) break

    try {
      const store = await db
        .selectFrom('woocommerce_stores')
        .select(['id', 'store_url', 'consumer_key_secret_ref', 'consumer_secret_secret_ref', 'last_synced_at'])
        .where('id', '=', job.store_id)
        .executeTakeFirstOrThrow()

      const orders = await fetchWooCommerceOrders(store)
      for (const order of orders) {
        await importWooOrder(store.id, order, null)
      }

      const now = new Date()
      await db.transaction().execute(async (trx) => {
        await trx
          .updateTable('woocommerce_sync_jobs')
          .set({
            status: 'completed',
            completed_at: now,
            imported_orders: orders.length,
            cursor_data: JSON.stringify({ completedAt: now.toISOString(), importedOrders: orders.length }),
            error_message: null,
          })
          .where('id', '=', job.id)
          .execute()

        await trx
          .updateTable('woocommerce_stores')
          .set({ sync_status: 'synced', last_synced_at: now, updated_at: now })
          .where('id', '=', store.id)
          .execute()
      })

      results.push({ jobId: job.id, storeId: store.id, status: 'completed', importedOrders: orders.length })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await db.transaction().execute(async (trx) => {
        await trx
          .updateTable('woocommerce_sync_jobs')
          .set({ status: 'failed', completed_at: new Date(), error_message: message })
          .where('id', '=', job.id)
          .execute()

        await trx
          .updateTable('woocommerce_stores')
          .set({ sync_status: 'sync_failed', updated_at: new Date() })
          .where('id', '=', job.store_id)
          .execute()
      })

      results.push({ jobId: job.id, storeId: job.store_id, status: 'failed', importedOrders: 0, error: message })
    }
  }

  return { processed: results.length, results }
}

function getWooOrderPayload(payload: unknown): z.infer<typeof wooOrderInput>['order'] | null {
  const direct = wooOrderInput.shape.order.safeParse(payload)
  if (direct.success) return direct.data

  if (Array.isArray(payload)) {
    for (const item of payload) {
      if (typeof item !== 'object' || !item || !('body' in item)) continue
      const wrapped = wooOrderInput.shape.order.safeParse(item.body)
      if (wrapped.success) return wrapped.data
    }
  }

  return null
}

async function markWebhookProcessed(eventId: string) {
  const { getDatabase } = await getServerDeps()
  await getDatabase()
    .updateTable('woocommerce_webhook_events')
    .set({ status: 'processed', processed_at: new Date(), error_message: null })
    .where('id', '=', eventId)
    .execute()
}

async function markWebhookFailed(eventId: string, error: unknown) {
  const { getDatabase } = await getServerDeps()
  await getDatabase()
    .updateTable('woocommerce_webhook_events')
    .set({ status: 'failed', error_message: error instanceof Error ? error.message : String(error) })
    .where('id', '=', eventId)
    .execute()
}

function numberValue(value: string | number | undefined, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function mapWooOrderStatus(status: string | undefined) {
  if (status === 'processing' || status === 'completed') return 'verified'
  if (status === 'cancelled' || status === 'refunded' || status === 'failed') return 'cancelled'
  if (status === 'on-hold') return 'finance_hold'
  return 'pending_payment'
}

function getTrackingItems(wooOrder: z.infer<typeof wooOrderInput>['order']) {
  const trackingMeta = wooOrder.meta_data?.find((meta) => meta.key === '_wc_shipment_tracking_items')
  return Array.isArray(trackingMeta?.value) ? trackingMeta.value : []
}

function firstStringProperty(value: unknown, property: string) {
  if (typeof value !== 'object' || !value || !(property in value)) return null
  const propertyValue = (value as Record<string, unknown>)[property]
  return typeof propertyValue === 'string' && propertyValue ? propertyValue : null
}

async function importWooOrder(storeId: string, wooOrder: z.infer<typeof wooOrderInput>['order'], actorUserId: string | null) {
  const { getDatabase, writeAuditLog } = await getServerDeps()
  const wooOrderId = String(wooOrder.id)
  const orderNumber = wooOrder.number ?? `WOO-${wooOrderId}`
  const billing = wooOrder.billing
  const shipping = wooOrder.shipping
  const customerName = [billing?.first_name, billing?.last_name].filter(Boolean).join(' ') || [shipping?.first_name, shipping?.last_name].filter(Boolean).join(' ') || 'WooCommerce customer'
  const trackingItems = getTrackingItems(wooOrder)
  const firstTracking = trackingItems[0]
  const trackingNumber = firstStringProperty(firstTracking, 'tracking_number')
  const trackingCourier = firstStringProperty(firstTracking, 'tracking_provider') ?? firstStringProperty(firstTracking, 'custom_tracking_provider')
  const subtotal = wooOrder.line_items?.reduce((sum, item) => sum + numberValue(item.total, numberValue(item.price) * numberValue(item.quantity, 1)), 0) ?? numberValue(wooOrder.subtotal, numberValue(wooOrder.total))
  const shippingTotal = numberValue(wooOrder.shipping_total)
  const discountAmount = numberValue(wooOrder.discount_total)
  const total = numberValue(wooOrder.total, subtotal + shippingTotal - discountAmount)
  const itemQuantityTotal = wooOrder.line_items?.reduce((sum, item) => sum + numberValue(item.quantity, 1), 0) ?? 0
  const orderStatus = mapWooOrderStatus(wooOrder.status)
  const now = new Date()
  const db = getDatabase()

  const result = await db.transaction().execute(async (trx) => {
    const existing = await trx
      .selectFrom('orders')
      .select(['id', 'customer_id', 'manually_processed_at', 'payment_status', 'fulfillment_status', 'order_status'])
      .where('woo_store_id', '=', storeId)
      .where('woo_order_id', '=', wooOrderId)
      .executeTakeFirst()

    if (existing?.manually_processed_at || existing?.payment_status === 'verified' || existing?.fulfillment_status === 'packed' || existing?.fulfillment_status === 'shipped') {
      return { id: existing.id, skippedManualDecision: true }
    }

    const customerValues = {
      seller_user_id: null,
      name: customerName,
      email: billing?.email ?? null,
      phone: billing?.phone ?? shipping?.phone ?? null,
      address_line: shipping?.address_1 ?? billing?.address_1 ?? null,
      city: shipping?.city ?? billing?.city ?? null,
      state: shipping?.state ?? billing?.state ?? null,
      country: shipping?.country ?? billing?.country ?? null,
      zip_code: shipping?.postcode ?? billing?.postcode ?? null,
      created_by_user_id: actorUserId,
      updated_at: now,
    }

    const customer = existing?.customer_id
      ? await trx.updateTable('customers').set(customerValues).where('id', '=', existing.customer_id).returning(['id']).executeTakeFirstOrThrow()
      : await trx.insertInto('customers').values(customerValues).returning(['id']).executeTakeFirstOrThrow()

    const orderValues = {
      order_number: orderNumber,
      customer_id: customer.id,
      order_status: orderStatus,
      payment_status: orderStatus === 'verified' ? 'verified' : 'pending',
      payment_method: wooOrder.payment_method ?? null,
      currency: wooOrder.currency ?? 'MYR',
      subtotal_amount: subtotal,
      shipping_total: shippingTotal,
      transaction_fee: 0,
      discount_amount: discountAmount,
      total_amount: total,
      item_quantity_total: itemQuantityTotal,
      item_quantity_distinct: wooOrder.line_items?.length ?? 0,
      tracking_courier: trackingCourier,
      tracking_number: trackingNumber,
      tracking_ids: JSON.stringify(trackingItems),
      customer_snapshot: JSON.stringify({ billing: wooOrder.billing ?? null, shipping: wooOrder.shipping ?? null }),
      woo_store_id: storeId,
      woo_order_id: wooOrderId,
      woo_transaction_id: wooOrder.transaction_id ?? null,
      woo_metadata: JSON.stringify(wooOrder),
      created_by_user_id: actorUserId,
      updated_at: now,
    }

    const order = existing
      ? await trx.updateTable('orders').set(orderValues).where('id', '=', existing.id).returning(['id']).executeTakeFirstOrThrow()
      : await trx.insertInto('orders').values(orderValues).returning(['id']).executeTakeFirstOrThrow()

    if (existing) {
      await trx.deleteFrom('order_items').where('order_id', '=', order.id).execute()
    }

    if (wooOrder.line_items?.length) {
      await trx
        .insertInto('order_items')
        .values(wooOrder.line_items.map((item) => ({
          order_id: order.id,
          product_id: null,
          quantity: numberValue(item.quantity, 1),
          order_price: numberValue(item.price, numberValue(item.total)),
          order_line_total: numberValue(item.total, numberValue(item.price)),
          fulfillment_status: 'pending',
          created_by_user_id: actorUserId,
        })))
        .execute()
    }

    return { id: order.id, skippedManualDecision: false }
  })

  if (actorUserId) {
    await writeAuditLog({ actorUserId, action: 'woocommerce.order.import', entityTable: 'orders', entityId: result.id, metadata: { wooOrderId, skippedManualDecision: result.skippedManualDecision } })
  }

  return result
}
