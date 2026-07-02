import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { sql } from 'kysely'
import { z } from 'zod'
import { calculateOrderTotal } from './business-rules'

const listOrdersInput = z
  .object({
    platformId: z.string().optional(),
    status: z.string().optional(),
    sellerUserId: z.string().optional(),
    tagId: z.string().optional(),
    website: z.string().optional(),
    search: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .optional()

const orderIdInput = z.object({ orderId: z.string().uuid() })

const orderStatuses = ['draft', 'pending_payment', 'finance_hold', 'verified', 'packing', 'shipped', 'cancelled'] as const

const updateOrderInput = z.object({
  orderId: z.string().uuid(),
  orderNumber: z.string().min(1),
  orderWebsite: z.string().optional(),
  platformCategory: z.string().optional(),
  platformOption: z.string().optional(),
  orderStatus: z.enum(orderStatuses),
  noteSummary: z.string().optional(),
  cancellationReason: z.string().optional(),
  customer: z.object({
    name: z.string().optional(),
    email: z.string().email().or(z.literal('')).optional(),
    phone: z.string().optional(),
    addressLine: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    zipCode: z.string().optional(),
  }),
})

const createOrderInput = z.object({
  orderNumber: z.string().min(1),
  customerId: z.string().uuid().optional(),
  customer: z
    .object({
      name: z.string().min(1),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      addressLine: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      zipCode: z.string().optional(),
    })
    .optional(),
  sellerUserId: z.string().optional(),
  paymentMethod: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid().optional(),
        bundleParentId: z.string().uuid().optional(),
        name: z.string().optional(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().min(0),
      }),
    )
    .min(1),
  shippingTotal: z.number().min(0).default(0),
  codFee: z.number().min(0).default(0),
  transactionFee: z.number().min(0).default(0),
  discountAmount: z.number().min(0).default(0),
  paymentProof: z
    .object({
      filename: z.string().min(1),
      contentType: z.string().optional(),
      base64: z.string().min(1),
      proofType: z.string().optional(),
    })
    .optional(),
})

const getServerDeps = createServerOnlyFn(async () => {
  const [db, authContext, salesScope] = await Promise.all([
    import('./db/client'),
    import('./server/auth-context'),
    import('./server/sales-scope'),
  ])

  return { ...db, ...authContext, ...salesScope }
})

export const listOrderCatalog = createServerFn({ method: 'GET' }).handler(async () => {
  const { getDatabase, requireCurrentUser } = await getServerDeps()
  await requireCurrentUser({ permissions: ['orders:own', 'orders:all'] })

  const products = await getDatabase()
    .selectFrom('products')
    .select(['id', 'name', 'sku_code', 'price_retail', 'price_distributor', 'product_type'])
    .where('status_ready', '=', true)
    .orderBy('name')
    .limit(200)
    .execute()

  return products.map((product) => ({
    ...product,
    price_retail: Number(product.price_retail),
    price_distributor: Number(product.price_distributor),
  }))
})

export const listOrders = createServerFn({ method: 'GET' })
  .validator(listOrdersInput)
  .handler(async ({ data }) => {
    const { getDatabase, getOrderScopeUserIds, requireCurrentUser } = await getServerDeps()
    const user = await requireCurrentUser()
    const input = data ?? { limit: 50 }
    const scopedUserIds = await getOrderScopeUserIds(user)
    let query = getDatabase()
      .selectFrom('orders')
      .leftJoin('customers', 'customers.id', 'orders.customer_id')
      .leftJoin('sales_team_platforms', 'sales_team_platforms.id', 'orders.platform_id')
      .select([
        'orders.id',
        'orders.order_number',
        'orders.seller_user_id',
        'orders.platform_id',
        'orders.order_status',
        'orders.payment_status',
        'orders.fulfillment_status',
        'orders.payment_method',
        'orders.currency',
        'orders.order_website',
        'orders.platform_category',
        'orders.platform_option',
        'orders.shipping_total',
        'orders.item_quantity_total',
        'orders.item_quantity_distinct',
        'orders.total_amount',
        'orders.tracking_courier',
        'orders.created_at',
        'sales_team_platforms.name as platform_name',
        sql<string>`coalesce(auth_users.name, app_users.name, orders.seller_user_id, 'Unassigned')`.as('seller_name'),
        'customers.name as customer_name',
        'customers.phone as customer_phone',
        'customers.address_line as customer_address_line',
        'customers.city as customer_city',
        'customers.state as customer_state',
        'customers.zip_code as customer_zip_code',
      ])
      .leftJoin('auth_users', 'auth_users.id', 'orders.seller_user_id')
      .leftJoin('app_users', 'app_users.legacy_bubble_id', 'orders.seller_user_id')
      .select((eb) => [
        sql<string | null>`(
          select import_rows.raw_data ->> 'Item Quantity Top'
          from bubble_import_rows import_rows
          where import_rows.entity_name = 'orders'
            and import_rows.legacy_bubble_id = ${eb.ref('orders.legacy_bubble_id')}
          order by import_rows.created_at desc
          limit 1
        )`.as('raw_item_quantity_top'),
      ])
      .orderBy('orders.created_at', 'desc')
      .limit(input.limit)

    if (input.status) {
      query = query.where('orders.order_status', '=', input.status)
    }

    if (input.platformId) {
      query = query.where('orders.platform_id', '=', input.platformId)
    }

    if (input.tagId) {
      query = query.where(sql<boolean>`exists (
        select 1
        from order_tags
        where order_tags.order_id = orders.id
          and order_tags.tag_id = ${input.tagId}
      )`)
    }

    if (input.website) {
      query = query.where('orders.order_website', '=', input.website)
    }

    if (input.search?.trim()) {
      const search = `%${input.search.trim()}%`
      query = query.where((eb) =>
        eb.or([
          eb('orders.order_number', 'ilike', search),
          eb('customers.name', 'ilike', search),
          eb('customers.phone', 'ilike', search),
          eb('orders.order_website', 'ilike', search),
          eb('sales_team_platforms.name', 'ilike', search),
        ]),
      )
    }

    if (scopedUserIds == null) {
      if (input.sellerUserId) {
        query = query.where('orders.seller_user_id', '=', input.sellerUserId)
      }
    } else {
      query = query.where('orders.seller_user_id', 'in', scopedUserIds)
    }

    const rows = await query.execute()
    const orderIds = rows.map((row) => row.id)
    const itemRows = orderIds.length
      ? await getDatabase()
        .selectFrom('order_items')
        .leftJoin('products', 'products.id', 'order_items.product_id')
        .select([
          'order_items.order_id',
          'order_items.quantity',
          'products.name as product_name',
          'products.sku_code as product_sku',
        ])
        .where('order_items.order_id', 'in', orderIds)
        .orderBy('order_items.created_at', 'asc')
        .execute()
      : []

    const itemsByOrder = new Map<string, typeof itemRows>()
    for (const item of itemRows) {
      const current = itemsByOrder.get(item.order_id) ?? []
      current.push(item)
      itemsByOrder.set(item.order_id, current)
    }

    const rowsWithItems = rows.map((row) => {
      const orderItems = itemsByOrder.get(row.id) ?? []
      const firstItem = orderItems[0]
      const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0)

      return {
        ...row,
        first_item_name: firstItem?.product_name ?? null,
        first_item_sku: firstItem?.product_sku ?? null,
        line_item_quantity_total: totalQuantity || row.item_quantity_total,
        line_item_distinct_total: orderItems.length || row.item_quantity_distinct,
      }
    })

    let scopedOptionsQuery = getDatabase()
      .selectFrom('orders')
      .leftJoin('sales_team_platforms', 'sales_team_platforms.id', 'orders.platform_id')
      .leftJoin('auth_users', 'auth_users.id', 'orders.seller_user_id')
      .leftJoin('app_users', 'app_users.legacy_bubble_id', 'orders.seller_user_id')

    if (scopedUserIds != null) {
      scopedOptionsQuery = scopedOptionsQuery.where('orders.seller_user_id', 'in', scopedUserIds)
    }

    const [platformOptions, userOptions, statusOptions, tagOptions, websiteOptions] = await Promise.all([
      scopedOptionsQuery
        .select(['orders.platform_id as value', 'sales_team_platforms.name as label'])
        .where('orders.platform_id', 'is not', null)
        .distinct()
        .orderBy('sales_team_platforms.name')
        .execute(),
      scopedOptionsQuery
        .select(['orders.seller_user_id as value', sql<string>`coalesce(auth_users.name, app_users.name, orders.seller_user_id)`.as('label')])
        .where('orders.seller_user_id', 'is not', null)
        .distinct()
        .orderBy('label')
        .execute(),
      scopedOptionsQuery
        .select('orders.order_status as value')
        .distinct()
        .orderBy('orders.order_status')
        .execute(),
      getDatabase()
        .selectFrom('order_tags')
        .innerJoin('orders', 'orders.id', 'order_tags.order_id')
        .innerJoin('tags', 'tags.id', 'order_tags.tag_id')
        .select(['tags.id as value', 'tags.name as label'])
        .$if(scopedUserIds != null, (qb) => qb.where('orders.seller_user_id', 'in', scopedUserIds ?? []))
        .distinct()
        .orderBy('tags.name')
        .execute(),
      scopedOptionsQuery
        .select('orders.order_website as value')
        .where('orders.order_website', 'is not', null)
        .distinct()
        .orderBy('orders.order_website')
        .execute(),
    ])

    return {
      rows: rowsWithItems,
      filters: {
        platforms: platformOptions
          .filter((option): option is { value: string; label: string } => Boolean(option.value && option.label))
          .map((option) => ({ value: option.value, label: option.label })),
        users: userOptions
          .filter((option): option is { value: string; label: string } => Boolean(option.value && option.label))
          .map((option) => ({ value: option.value, label: option.label })),
        statuses: statusOptions
          .filter((option): option is { value: string } => Boolean(option.value))
          .map((option) => ({ value: option.value, label: option.value })),
        tags: tagOptions
          .filter((option): option is { value: string; label: string } => Boolean(option.value && option.label))
          .map((option) => ({ value: option.value, label: option.label })),
        websites: websiteOptions
          .filter((option): option is { value: string } => Boolean(option.value))
          .map((option) => ({ value: option.value, label: option.value })),
      },
    }
  })

export const getOrderDetail = createServerFn({ method: 'GET' })
  .validator(orderIdInput)
  .handler(async ({ data }) => {
    const { ForbiddenError, getDatabase, getOrderScopeUserIds, isUserIdWithinScope, requireCurrentUser } = await getServerDeps()
    const user = await requireCurrentUser()
    const scopedUserIds = await getOrderScopeUserIds(user)
    const order = await getDatabase()
      .selectFrom('orders')
      .leftJoin('customers', 'customers.id', 'orders.customer_id')
      .leftJoin('sales_team_platforms', 'sales_team_platforms.id', 'orders.platform_id')
      .selectAll('orders')
      .select([
        'customers.name as customer_name',
        'customers.email as customer_email',
        'customers.phone as customer_phone',
        'customers.address_line as customer_address_line',
        'customers.city as customer_city',
        'customers.state as customer_state',
        'customers.country as customer_country',
        'customers.zip_code as customer_zip_code',
        'customers.note as customer_note',
        'sales_team_platforms.name as platform_name',
      ])
      .select((eb) => [
        sql<string | null>`(
          select import_rows.raw_data ->> 'Item Quantity Top'
          from bubble_import_rows import_rows
          where import_rows.entity_name = 'orders'
            and import_rows.legacy_bubble_id = ${eb.ref('orders.legacy_bubble_id')}
          order by import_rows.created_at desc
          limit 1
        )`.as('raw_item_quantity_top'),
      ])
      .where('orders.id', '=', data.orderId)
      .executeTakeFirst()

    if (!order) return null
    if (!isUserIdWithinScope(order.seller_user_id, scopedUserIds)) {
      throw new ForbiddenError()
    }

    const items = await getDatabase()
      .selectFrom('order_items')
      .leftJoin('products', 'products.id', 'order_items.product_id')
      .select([
        'order_items.id',
        'order_items.quantity',
        'order_items.order_price',
        'order_items.order_line_total',
        'products.name as product_name',
        'products.sku_code as product_sku',
      ])
      .where('order_items.order_id', '=', data.orderId)
      .execute()

    return { order, items }
  })

export const updateOrder = createServerFn({ method: 'POST' })
  .validator(updateOrderInput)
  .handler(async ({ data }) => {
    const { ForbiddenError, getDatabase, getOrderScopeUserIds, isUserIdWithinScope, requireCurrentUser, writeAuditLog } = await getServerDeps()
    const user = await requireCurrentUser({ permissions: ['orders:own', 'orders:all'] })
    const scopedUserIds = await getOrderScopeUserIds(user)
    const db = getDatabase()
    const existingOrder = await db
      .selectFrom('orders')
      .select([
        'id',
        'order_number',
        'seller_user_id',
        'customer_id',
        'customer_snapshot',
        'order_status',
        'order_website',
        'platform_category',
        'platform_option',
        'cancelled_at',
        'cancelled_by_user_id',
        'cancellation_reason',
        'note_summary',
      ])
      .where('id', '=', data.orderId)
      .executeTakeFirst()

    if (!existingOrder) {
      throw new Error('Order not found')
    }

    if (!isUserIdWithinScope(existingOrder.seller_user_id, scopedUserIds)) {
      throw new ForbiddenError()
    }

    const trimmedCancellationReason = data.cancellationReason?.trim() || null
    if (data.orderStatus === 'cancelled' && !trimmedCancellationReason) {
      throw new Error('Cancellation reason is required when cancelling an order.')
    }

    const customerSnapshot = {
      ...(existingOrder.customer_snapshot && typeof existingOrder.customer_snapshot === 'object' && !Array.isArray(existingOrder.customer_snapshot)
        ? existingOrder.customer_snapshot
        : {}),
      billing: {
        name: data.customer.name?.trim() || null,
        email: data.customer.email?.trim() || null,
        phone: data.customer.phone?.trim() || null,
      },
      shipping: {
        address_1: data.customer.addressLine?.trim() || null,
        city: data.customer.city?.trim() || null,
        state: data.customer.state?.trim() || null,
        country: data.customer.country?.trim() || null,
        postcode: data.customer.zipCode?.trim() || null,
      },
    }

    const cancelledAt = data.orderStatus === 'cancelled'
      ? existingOrder.cancelled_at ?? new Date()
      : null
    const cancelledByUserId = data.orderStatus === 'cancelled'
      ? existingOrder.cancelled_by_user_id ?? user.id
      : null

    const order = await db
      .updateTable('orders')
      .set({
        order_number: data.orderNumber.trim(),
        customer_snapshot: JSON.stringify(customerSnapshot),
        order_status: data.orderStatus,
        order_website: data.orderWebsite?.trim() || null,
        platform_category: data.platformCategory?.trim() || null,
        platform_option: data.platformOption?.trim() || null,
        cancelled_at: cancelledAt,
        cancelled_by_user_id: cancelledByUserId,
        cancellation_reason: data.orderStatus === 'cancelled' ? trimmedCancellationReason : null,
        note_summary: data.noteSummary?.trim() || null,
        updated_at: new Date(),
      })
      .where('id', '=', data.orderId)
      .returning(['id', 'order_number', 'order_status'])
      .executeTakeFirstOrThrow()

    await writeAuditLog({
      actorUserId: user.id,
      action: 'order.update',
      entityTable: 'orders',
      entityId: order.id,
      beforeData: existingOrder,
      afterData: order,
    })

    return order
  })

export const createOrder = createServerFn({ method: 'POST' })
  .validator(createOrderInput)
  .handler(async ({ data }) => {
    const { getDatabase, requireCurrentUser, writeAuditLog } = await getServerDeps()
    const user = await requireCurrentUser({ permissions: ['orders:own', 'orders:all'] })
    const itemsSubtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    const totals = calculateOrderTotal({ ...data, itemsSubtotal })
    const sellerUserId = user.permissions.includes('orders:all') ? data.sellerUserId ?? user.id : user.id
    const db = getDatabase()
    const bunny = data.paymentProof ? await import('./storage/bunny') : null
    const bunnyConfig = bunny ? bunny.getBunnyConfig() : null

    const order = await db.transaction().execute(async (trx) => {
      let customerId = data.customerId ?? null
      let customerSnapshot = data.customer ? { ...data.customer } : {}

      if (!customerId && data.customer) {
        const customer = await trx
          .insertInto('customers')
          .values({
            seller_user_id: sellerUserId,
            name: data.customer.name,
            email: data.customer.email ?? null,
            phone: data.customer.phone ?? null,
            address_line: data.customer.addressLine ?? null,
            city: data.customer.city ?? null,
            state: data.customer.state ?? null,
            country: data.customer.country ?? null,
            zip_code: data.customer.zipCode ?? null,
            created_by_user_id: user.id,
          })
          .returning(['id'])
          .executeTakeFirstOrThrow()

        customerId = customer.id
      } else if (customerId) {
        const customer = await trx
          .selectFrom('customers')
          .select(['name', 'email', 'phone', 'address_line', 'city', 'state', 'country', 'zip_code'])
          .where('id', '=', customerId)
          .executeTakeFirst()

        customerSnapshot = customer ?? {}
      }

      const createdOrder = await trx
        .insertInto('orders')
        .values({
          order_number: data.orderNumber,
          seller_user_id: sellerUserId,
          customer_id: customerId,
          customer_snapshot: JSON.stringify(customerSnapshot),
          order_status: 'pending_payment',
          payment_status: 'pending',
          payment_method: data.paymentMethod ?? null,
          subtotal_amount: totals.subtotal,
          shipping_total: totals.shipping,
          cod_fee: totals.codFee,
          transaction_fee: totals.transactionFee,
          discount_amount: totals.discount,
          total_amount: totals.total,
          item_quantity_total: data.items.reduce((sum, item) => sum + item.quantity, 0),
          item_quantity_distinct: data.items.length,
          created_by_user_id: user.id,
        })
        .returning(['id', 'order_number', 'total_amount'])
        .executeTakeFirstOrThrow()

      await trx
        .insertInto('order_items')
        .values(
          data.items.map((item) => ({
            order_id: createdOrder.id,
            product_id: item.productId ?? null,
            bundle_parent_id: item.bundleParentId ?? null,
            quantity: item.quantity,
            order_price: item.unitPrice,
            order_line_total: item.quantity * item.unitPrice,
            fulfillment_status: 'pending',
            created_by_user_id: user.id,
          })),
        )
        .execute()

      const reserveItems = data.items.filter((item) => item.productId)
      if (reserveItems.length) {
        await trx
          .insertInto('stock_movements')
          .values(
            reserveItems.map((item) => ({
              movement_type: 'order_reserve',
              product_id: item.productId!,
              order_id: createdOrder.id,
              user_related_id: sellerUserId,
              quantity: -Math.abs(item.quantity),
              remark: `Reserve for order ${data.orderNumber}`,
              created_by_user_id: user.id,
            })),
          )
          .execute()
      }

      if (data.paymentProof && bunny && bunnyConfig) {
        const path = `payment-proofs/${createdOrder.id}/${Date.now()}-${data.paymentProof.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        const upload = await bunny.uploadToBunny({
          path,
          body: Buffer.from(data.paymentProof.base64, 'base64'),
          contentType: data.paymentProof.contentType,
        }, bunnyConfig)

        const file = await trx
          .insertInto('files')
          .values({
            storage_provider: 'bunny',
            storage_zone: bunnyConfig.storageZone,
            path: upload.path,
            public_url: upload.publicUrl,
            mime_type: data.paymentProof.contentType ?? null,
            size_bytes: Buffer.byteLength(data.paymentProof.base64, 'base64'),
            original_filename: data.paymentProof.filename,
            uploaded_by_user_id: user.id,
          })
          .returning(['id'])
          .executeTakeFirstOrThrow()

        await trx
          .insertInto('order_payment_proofs')
          .values({
            order_id: createdOrder.id,
            file_id: file.id,
            proof_type: data.paymentProof.proofType ?? 'payment',
            metadata: JSON.stringify({ source: 'orders_new' }),
            created_by_user_id: user.id,
          })
          .execute()
      }

      return createdOrder
    })

    await writeAuditLog({
      actorUserId: user.id,
      action: 'order.create',
      entityTable: 'orders',
      entityId: order.id,
      afterData: order,
    })

    return order
  })
