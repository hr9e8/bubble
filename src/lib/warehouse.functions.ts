import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { sql } from 'kysely'
import { z } from 'zod'

const trackingInput = z.object({
  orderId: z.string().uuid(),
  courierId: z.string().uuid().optional(),
  courierName: z.string().optional(),
  trackingNumber: z.string().min(1),
  trackingUrl: z.string().url().optional(),
  shipmentId: z.string().optional(),
  awbLabelFileId: z.string().uuid().optional(),
  awbLabelUrl: z.string().url().optional(),
})

const orderIdInput = z.object({ orderId: z.string().uuid() })

const listManifestsInput = z
  .object({
    limit: z.number().int().min(1).max(200).default(100),
  })
  .optional()

const getServerDeps = createServerOnlyFn(async () => {
  const [db, authContext] = await Promise.all([
    import('./db/client'),
    import('./server/auth-context'),
  ])

  return { ...db, ...authContext }
})

export const listWarehouseQueue = createServerFn({ method: 'GET' }).handler(async () => {
  const { getDatabase, requireCurrentUser } = await getServerDeps()
  await requireCurrentUser({ permissions: ['warehouse:fulfill'] })

  return getDatabase()
    .selectFrom('orders')
    .leftJoin('customers', 'customers.id', 'orders.customer_id')
    .select([
      'orders.id',
      'orders.order_number',
      'orders.order_status',
      'orders.fulfillment_status',
      'orders.total_amount',
      'orders.created_at',
      'customers.name as customer_name',
    ])
    .where('orders.order_status', 'in', ['verified', 'packing'])
    .orderBy('orders.created_at', 'asc')
    .limit(100)
    .execute()
})

export const listWarehouseManifests = createServerFn({ method: 'GET' })
  .validator(listManifestsInput)
  .handler(async ({ data }) => {
    const { getDatabase, requireCurrentUser } = await getServerDeps()
    await requireCurrentUser({ permissions: ['warehouse:fulfill'] })
    const limit = data?.limit ?? 100

    const [rows, totals] = await Promise.all([
      getDatabase()
        .selectFrom('order_manifests')
        .leftJoin('orders', 'orders.order_number', 'order_manifests.order_number')
        .select([
          'order_manifests.id',
          'order_manifests.order_number',
          'order_manifests.custom_courier',
          'order_manifests.manifest_datetime',
          'order_manifests.group_manifest_id',
          'order_manifests.handler_data',
          'order_manifests.shipping_awb_barcode',
          'order_manifests.shipping_awb_no',
          'order_manifests.shipping_courier_name',
          'order_manifests.weight',
          'order_manifests.created_by',
          'order_manifests.created_at',
          'orders.id as order_id',
          'orders.order_status',
          'orders.fulfillment_status',
          'orders.tracking_number',
          'orders.tracking_url',
        ])
        .orderBy('order_manifests.manifest_datetime', 'desc')
        .orderBy('order_manifests.created_at', 'desc')
        .limit(limit)
        .execute(),
      getDatabase()
        .selectFrom('order_manifests')
        .select((eb) => [
          eb.fn.countAll().as('manifest_count'),
          sql<string>`count(distinct group_manifest_id) filter (where group_manifest_id is not null and group_manifest_id <> '')`.as('group_count'),
          sql<string>`count(*) filter (where shipping_awb_no is not null and shipping_awb_no <> '')`.as('awb_count'),
          sql<string>`coalesce(sum(weight), 0)`.as('total_weight'),
        ])
        .executeTakeFirst(),
    ])

    return {
      rows: rows.map((row) => ({
        ...row,
        weight: row.weight == null ? null : Number(row.weight),
      })),
      stats: {
        manifestCount: Number(totals?.manifest_count ?? 0),
        groupCount: Number(totals?.group_count ?? 0),
        awbCount: Number(totals?.awb_count ?? 0),
        totalWeight: Number(totals?.total_weight ?? 0),
      },
    }
  })

export const getWarehouseOrderDetail = createServerFn({ method: 'GET' })
  .validator(orderIdInput)
  .handler(async ({ data }) => {
    const { getDatabase, requireCurrentUser } = await getServerDeps()
    await requireCurrentUser({ permissions: ['warehouse:fulfill'] })

    const order = await getDatabase()
      .selectFrom('orders')
      .leftJoin('customers', 'customers.id', 'orders.customer_id')
      .select([
        'orders.id',
        'orders.order_number',
        'orders.order_status',
        'orders.fulfillment_status',
        'orders.payment_status',
        'orders.tracking_courier',
        'orders.tracking_number',
        'orders.tracking_url',
        'orders.total_amount',
        'customers.name as customer_name',
      ])
      .where('orders.id', '=', data.orderId)
      .executeTakeFirst()

    if (!order) return null

    const [items, events] = await Promise.all([
      getDatabase()
        .selectFrom('order_items')
        .leftJoin('products', 'products.id', 'order_items.product_id')
        .select(['order_items.id', 'order_items.quantity', 'order_items.fulfillment_status', 'products.name as product_name', 'products.sku_code'])
        .where('order_items.order_id', '=', data.orderId)
        .execute(),
      getDatabase()
        .selectFrom('warehouse_events')
        .leftJoin('files', 'files.id', 'warehouse_events.awb_label_file_id')
        .select([
          'warehouse_events.id',
          'warehouse_events.event_type',
          'warehouse_events.tracking_number',
          'warehouse_events.tracking_url',
          'warehouse_events.shipment_id',
          'warehouse_events.created_by_user_id',
          'warehouse_events.created_at',
          'files.public_url as awb_label_url',
          'files.original_filename as awb_label_filename',
        ])
        .where('warehouse_events.order_id', '=', data.orderId)
        .orderBy('warehouse_events.created_at', 'desc')
        .execute(),
    ])

    return { order, items, events }
  })

export const markOrderPicked = createServerFn({ method: 'POST' })
  .validator(orderIdInput)
  .handler(async ({ data }) => recordWarehouseEvent(data.orderId, 'picked'))

export const markOrderPacked = createServerFn({ method: 'POST' })
  .validator(orderIdInput)
  .handler(async ({ data }) => {
    const { getDatabase } = await getServerDeps()
    const event = await recordWarehouseEvent(data.orderId, 'packed')
    await getDatabase()
      .updateTable('orders')
      .set({ fulfillment_status: 'packed', order_status: 'packing', packed_by_user_id: event.created_by_user_id, packed_at: new Date(), updated_at: new Date() })
      .where('id', '=', data.orderId)
      .execute()
    return event
  })

export const updateTracking = createServerFn({ method: 'POST' })
  .validator(trackingInput)
  .handler(async ({ data }) => {
    const { getDatabase, requireCurrentUser, writeAuditLog } = await getServerDeps()
    const user = await requireCurrentUser({ permissions: ['warehouse:fulfill'] })
    const now = new Date()

    const event = await getDatabase()
      .insertInto('warehouse_events')
      .values({
        order_id: data.orderId,
        event_type: 'tracking_updated',
        courier_id: data.courierId ?? null,
        tracking_number: data.trackingNumber,
        tracking_url: data.trackingUrl ?? null,
        shipment_id: data.shipmentId ?? null,
        awb_label_file_id: data.awbLabelFileId ?? null,
        created_by_user_id: user.id,
        metadata: JSON.stringify({ courierName: data.courierName ?? null, awbLabelUrl: data.awbLabelUrl ?? null }),
      })
      .returning(['id', 'order_id', 'event_type'])
      .executeTakeFirstOrThrow()

    await getDatabase()
      .updateTable('orders')
      .set({
        tracking_courier: data.courierName ?? null,
        tracking_number: data.trackingNumber,
        tracking_url: data.trackingUrl ?? null,
        tracking_ids: JSON.stringify([{ trackingNumber: data.trackingNumber, shipmentId: data.shipmentId ?? null, awbLabelFileId: data.awbLabelFileId ?? null, awbLabelUrl: data.awbLabelUrl ?? null }]),
        updated_at: now,
      })
      .where('id', '=', data.orderId)
      .execute()

    await writeAuditLog({ actorUserId: user.id, action: 'warehouse.tracking_updated', entityTable: 'warehouse_events', entityId: event.id, afterData: event })
    return event
  })

export const markOrderShipped = createServerFn({ method: 'POST' })
  .validator(orderIdInput)
  .handler(async ({ data }) => {
    const { getDatabase } = await getServerDeps()
    const event = await recordWarehouseEvent(data.orderId, 'shipped')
    await getDatabase()
      .updateTable('orders')
      .set({ fulfillment_status: 'shipped', order_status: 'shipped', shipped_at: new Date(), updated_at: new Date() })
      .where('id', '=', data.orderId)
      .execute()
    return event
  })

async function recordWarehouseEvent(orderId: string, eventType: 'picked' | 'packed' | 'shipped') {
  const { getDatabase, requireCurrentUser, writeAuditLog } = await getServerDeps()
  const user = await requireCurrentUser({ permissions: ['warehouse:fulfill'] })
  const event = await getDatabase()
    .insertInto('warehouse_events')
    .values({
      order_id: orderId,
      event_type: eventType,
      packed_by_user_id: eventType === 'packed' ? user.id : null,
      created_by_user_id: user.id,
    })
    .returning(['id', 'order_id', 'event_type', 'created_by_user_id'])
    .executeTakeFirstOrThrow()

  await writeAuditLog({ actorUserId: user.id, action: `warehouse.${eventType}`, entityTable: 'warehouse_events', entityId: event.id, afterData: event })
  return event
}
