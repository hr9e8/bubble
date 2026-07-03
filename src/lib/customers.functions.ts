import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { sql } from 'kysely'
import { z } from 'zod'
import { buildCustomerCsv, buildCustomerWorkbook, type CustomerExportRow } from './exports/customers'
import { formatInternationalPhone, titleCase } from './utils'

const customerIdInput = z.object({ customerId: z.string().uuid() })

const listCustomersInput = z
  .object({
    query: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .optional()

const customerDirectoryInput = z
  .object({
    query: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(50),
    segment: z.enum(['all', 'best', 'atRisk']).default('all'),
    minOrders: z.number().int().min(0).optional(),
    maxOrders: z.number().int().min(0).optional(),
    lastOrder: z.enum(['last30', 'last60', 'last90', 'older90', 'none']).optional(),
    sellerUserId: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
  })
  .optional()

const exportCustomersInput = customerDirectoryInput.unwrap().omit({ limit: true }).extend({
  format: z.enum(['csv', 'xlsx']),
})

const upsertCustomerInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  addressLine: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  zipCode: z.string().optional(),
})

const getServerDeps = createServerOnlyFn(async () => {
  const [db, authContext, salesScope] = await Promise.all([
    import('./db/client'),
    import('./server/auth-context'),
    import('./server/sales-scope'),
  ])

  return { ...db, ...authContext, ...salesScope }
})

async function loadCustomerRows(input?: {
  query?: string
  limit?: number
  segment?: 'all' | 'best' | 'atRisk'
  minOrders?: number
  maxOrders?: number
  lastOrder?: 'last30' | 'last60' | 'last90' | 'older90' | 'none'
  sellerUserId?: string
  state?: string
  country?: string
}) {
  const { getDatabase, getOrderScopeUserIds, requireCurrentUser } = await getServerDeps()
  const user = await requireCurrentUser({ permissions: ['orders:own', 'orders:all', 'orders:team'] })
  const scopedUserIds = await getOrderScopeUserIds(user)

  let orderMetricsQuery = getDatabase()
    .selectFrom('orders')
    .leftJoin('auth_users', 'auth_users.id', 'orders.seller_user_id')
    .leftJoin('app_users', 'app_users.legacy_bubble_id', 'orders.seller_user_id')
    .select([
      'orders.customer_id',
      sql<string>`coalesce(sum(orders.total_amount), 0)`.as('lifetime_value'),
      sql<string>`count(orders.id)`.as('lifetime_orders'),
      sql<Date | null>`max(orders.created_at)`.as('last_order_date'),
      sql<string>`coalesce(string_agg(distinct coalesce(auth_users.name, app_users.name, orders.seller_user_id), ', '), '')`.as('seller_names'),
    ])
    .where('orders.customer_id', 'is not', null)
    .groupBy('orders.customer_id')

  if (scopedUserIds != null) {
    orderMetricsQuery = orderMetricsQuery.where('orders.seller_user_id', 'in', scopedUserIds)
  }

  const orderMetrics = orderMetricsQuery.as('order_metrics')

  let query = getDatabase()
    .selectFrom('customers')
    .leftJoin(orderMetrics, 'order_metrics.customer_id', 'customers.id')
    .select([
      'customers.id',
      'customers.name',
      'customers.email',
      'customers.phone',
      'customers.address_line',
      'customers.city',
      'customers.state',
      'customers.country',
      'customers.zip_code',
      'customers.seller_user_id',
      'customers.created_at',
      sql<string>`coalesce(order_metrics.lifetime_value, 0)`.as('lifetime_value'),
      sql<string>`coalesce(order_metrics.lifetime_orders, 0)`.as('lifetime_orders'),
      sql<string>`coalesce(order_metrics.seller_names, customers.seller_user_id, '')`.as('seller_names'),
      'order_metrics.last_order_date',
    ])

  if (input?.segment === 'best') {
    query = query.where(sql<boolean>`coalesce(order_metrics.lifetime_orders, 0) >= 3`)
  }

  if (input?.segment === 'atRisk') {
    query = query
      .where(sql<boolean>`coalesce(order_metrics.lifetime_orders, 0) > 0`)
      .where(sql<boolean>`order_metrics.last_order_date < now() - interval '60 days'`)
  }

  if (input?.query) {
    query = query.where((eb) =>
      eb.or([
        eb('customers.name', 'ilike', `%${input.query}%`),
        eb('customers.email', 'ilike', `%${input.query}%`),
        eb('customers.phone', 'ilike', `%${input.query}%`),
      ]),
    )
  }

  if (input?.minOrders != null) {
    query = query.where(sql<boolean>`coalesce(order_metrics.lifetime_orders, 0) >= ${input.minOrders}`)
  }

  if (input?.maxOrders != null) {
    query = query.where(sql<boolean>`coalesce(order_metrics.lifetime_orders, 0) <= ${input.maxOrders}`)
  }

  if (input?.lastOrder === 'last30') {
    query = query.where(sql<boolean>`order_metrics.last_order_date >= now() - interval '30 days'`)
  } else if (input?.lastOrder === 'last60') {
    query = query.where(sql<boolean>`order_metrics.last_order_date >= now() - interval '60 days'`)
  } else if (input?.lastOrder === 'last90') {
    query = query.where(sql<boolean>`order_metrics.last_order_date >= now() - interval '90 days'`)
  } else if (input?.lastOrder === 'older90') {
    query = query.where(sql<boolean>`order_metrics.last_order_date < now() - interval '90 days'`)
  } else if (input?.lastOrder === 'none') {
    query = query.where('order_metrics.customer_id', 'is', null)
  }

  const sellerUserId = input?.sellerUserId
  if (sellerUserId) {
    query = query.where((eb) =>
      eb.or([
        eb('customers.seller_user_id', '=', sellerUserId),
        eb.exists(
          eb
            .selectFrom('orders as seller_orders')
            .select('seller_orders.id')
            .whereRef('seller_orders.customer_id', '=', 'customers.id')
            .where('seller_orders.seller_user_id', '=', sellerUserId),
        ),
      ]),
    )
  }

  if (input?.country) {
    query = query.where('customers.country', 'ilike', input.country)
  }

  if (input?.state) {
    query = query.where('customers.state', 'ilike', input.state)
  }

  if (scopedUserIds != null) {
    query = query.where((eb) =>
      eb.or([
        eb('customers.seller_user_id', 'in', scopedUserIds),
        eb('order_metrics.customer_id', 'is not', null),
      ]),
    )
  }

  if (input?.segment === 'best') {
    query = query.orderBy(sql`coalesce(order_metrics.lifetime_value, 0)`, 'desc')
  } else if (input?.segment === 'atRisk') {
    query = query.orderBy('order_metrics.last_order_date', 'asc')
  } else {
    query = query.orderBy('customers.created_at', 'desc')
  }

  if (input?.limit) {
    query = query.limit(input.limit)
  }

  return query.execute()
}

async function loadCustomerFilterOptions() {
  const { getDatabase, getOrderScopeUserIds, requireCurrentUser } = await getServerDeps()
  const user = await requireCurrentUser({ permissions: ['orders:own', 'orders:all', 'orders:team'] })
  const scopedUserIds = await getOrderScopeUserIds(user)

  let sellerQuery = getDatabase()
    .selectFrom('orders')
    .leftJoin('auth_users', 'auth_users.id', 'orders.seller_user_id')
    .leftJoin('app_users', 'app_users.legacy_bubble_id', 'orders.seller_user_id')
    .select(['orders.seller_user_id as value', sql<string>`coalesce(auth_users.name, app_users.name, orders.seller_user_id)`.as('label')])
    .where('orders.seller_user_id', 'is not', null)
    .groupBy(['orders.seller_user_id', 'auth_users.name', 'app_users.name'])
    .orderBy('label')
    .limit(200)

  if (scopedUserIds != null) {
    sellerQuery = sellerQuery.where('orders.seller_user_id', 'in', scopedUserIds)
  }

  let stateQuery = getDatabase()
    .selectFrom('customers')
    .select(['state as value'])
    .where('state', 'is not', null)
    .groupBy('state')
    .orderBy('state')
    .limit(200)

  let countryQuery = getDatabase()
    .selectFrom('customers')
    .select(['country as value'])
    .where('country', 'is not', null)
    .groupBy('country')
    .orderBy('country')
    .limit(200)

  if (scopedUserIds != null) {
    stateQuery = stateQuery.where((eb) =>
      eb.or([
        eb('customers.seller_user_id', 'in', scopedUserIds),
        eb.exists(
          eb
            .selectFrom('orders as scoped_orders')
            .select('scoped_orders.id')
            .whereRef('scoped_orders.customer_id', '=', 'customers.id')
            .where('scoped_orders.seller_user_id', 'in', scopedUserIds),
        ),
      ]),
    )

    countryQuery = countryQuery.where((eb) =>
      eb.or([
        eb('customers.seller_user_id', 'in', scopedUserIds),
        eb.exists(
          eb
            .selectFrom('orders as scoped_orders')
            .select('scoped_orders.id')
            .whereRef('scoped_orders.customer_id', '=', 'customers.id')
            .where('scoped_orders.seller_user_id', 'in', scopedUserIds),
        ),
      ]),
    )
  }

  const [sellers, states, countries] = await Promise.all([sellerQuery.execute(), stateQuery.execute(), countryQuery.execute()])

  const stateOptions = new Map<string, string>()
  for (const option of states) {
    const value = option.value?.trim()
    if (!value || !/[A-Za-z].*[A-Za-z]/.test(value)) continue
    stateOptions.set(value.toLocaleLowerCase('en-MY'), value)
  }

  const countryOptions = new Map<string, string>()
  for (const option of countries) {
    const value = option.value?.trim()
    if (!value || !/[A-Za-z].*[A-Za-z]/.test(value)) continue
    countryOptions.set(value.toLocaleLowerCase('en-MY'), value)
  }

  return {
    sellers: sellers.filter((option): option is { value: string; label: string } => Boolean(option.value && option.label)),
    states: [...stateOptions.values()].map((value) => ({ value, label: titleCase(value) })),
    countries: [...countryOptions.values()].map((value) => ({ value, label: titleCase(value) })),
  }
}

function exportRow(row: Awaited<ReturnType<typeof loadCustomerRows>>[number]): CustomerExportRow {
  return {
    name: titleCase(row.name),
    email: row.email ?? '',
    phone: formatInternationalPhone(row.phone, row.country),
    address: [titleCase(row.address_line), titleCase(row.city), titleCase(row.state), titleCase(row.country), row.zip_code].filter(Boolean).join(', '),
    sellers: row.seller_names || 'Unassigned',
    lifetimeValue: Number(row.lifetime_value),
    lifetimeOrders: Number(row.lifetime_orders),
    lastOrderDate: row.last_order_date,
  }
}

export const listCustomers = createServerFn({ method: 'GET' })
  .validator(listCustomersInput)
  .handler(async ({ data }) => loadCustomerRows(data ?? { limit: 50 }))

export const listCustomerDirectory = createServerFn({ method: 'GET' })
  .validator(customerDirectoryInput)
  .handler(async ({ data }) => {
    const input = data ?? { limit: 50, segment: 'all' as const }
    const [rows, filters] = await Promise.all([
      loadCustomerRows(input),
      loadCustomerFilterOptions(),
    ])

    return { rows, filters }
  })

export const exportCustomers = createServerFn({ method: 'POST' })
  .validator(exportCustomersInput)
  .handler(async ({ data }) => {
    const rows = (await loadCustomerRows(data)).map(exportRow)
    const timestamp = new Date().toISOString().slice(0, 10)

    if (data.format === 'csv') {
      return {
        filename: `customers-${timestamp}.csv`,
        mimeType: 'text/csv;charset=utf-8',
        base64: Buffer.from(buildCustomerCsv(rows), 'utf8').toString('base64'),
      }
    }

    const buffer = await buildCustomerWorkbook(rows)

    return {
      filename: `customers-${timestamp}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      base64: Buffer.from(buffer).toString('base64'),
    }
  })

export const getCustomerDetail = createServerFn({ method: 'GET' })
  .validator(customerIdInput)
  .handler(async ({ data }) => {
    const { ForbiddenError, getDatabase, getOrderScopeUserIds, isUserIdWithinScope, requireCurrentUser } = await getServerDeps()
    const user = await requireCurrentUser({ permissions: ['orders:own', 'orders:all', 'orders:team'] })
    const scopedUserIds = await getOrderScopeUserIds(user)

    let orderMetricsQuery = getDatabase()
      .selectFrom('orders')
      .leftJoin('auth_users', 'auth_users.id', 'orders.seller_user_id')
      .leftJoin('app_users', 'app_users.legacy_bubble_id', 'orders.seller_user_id')
      .select([
        'orders.customer_id',
        sql<string>`coalesce(sum(orders.total_amount), 0)`.as('lifetime_value'),
        sql<string>`count(orders.id)`.as('lifetime_orders'),
        sql<Date | null>`max(orders.created_at)`.as('last_order_date'),
        sql<string>`coalesce(string_agg(distinct coalesce(auth_users.name, app_users.name, orders.seller_user_id), ', '), '')`.as('seller_names'),
      ])
      .where('orders.customer_id', '=', data.customerId)
      .groupBy('orders.customer_id')

    if (scopedUserIds != null) {
      orderMetricsQuery = orderMetricsQuery.where('orders.seller_user_id', 'in', scopedUserIds)
    }

    const orderMetrics = orderMetricsQuery.as('order_metrics')
    const customer = await getDatabase()
      .selectFrom('customers')
      .leftJoin(orderMetrics, 'order_metrics.customer_id', 'customers.id')
      .selectAll('customers')
      .select([
        'order_metrics.customer_id as scoped_order_customer_id',
        sql<string>`coalesce(order_metrics.lifetime_value, 0)`.as('lifetime_value'),
        sql<string>`coalesce(order_metrics.lifetime_orders, 0)`.as('lifetime_orders'),
        'order_metrics.last_order_date',
        sql<string>`coalesce(order_metrics.seller_names, customers.seller_user_id, '')`.as('seller_names'),
      ])
      .where('customers.id', '=', data.customerId)
      .executeTakeFirst()

    if (!customer) return null
    if (!isUserIdWithinScope(customer.seller_user_id, scopedUserIds) && !customer.scoped_order_customer_id) {
      throw new ForbiddenError()
    }

    const orders = await getDatabase()
      .selectFrom('orders')
      .leftJoin('auth_users', 'auth_users.id', 'orders.seller_user_id')
      .leftJoin('app_users', 'app_users.legacy_bubble_id', 'orders.seller_user_id')
      .select([
        'orders.id',
        'orders.order_number',
        'orders.order_status',
        'orders.payment_status',
        'orders.payment_method',
        'orders.currency',
        'orders.total_amount',
        'orders.shipping_total',
        'orders.created_at',
        'orders.platform_category',
        'orders.platform_option',
        'orders.order_website',
        sql<string>`coalesce(auth_users.name, app_users.name, orders.seller_user_id, 'Unassigned')`.as('seller_name'),
      ])
      .where('orders.customer_id', '=', data.customerId)
      .$if(scopedUserIds != null, (qb) => qb.where('orders.seller_user_id', 'in', scopedUserIds ?? []))
      .orderBy('orders.created_at', 'desc')
      .limit(100)
      .execute()

    const orderIds = orders.map((order) => order.id)
    const items = orderIds.length
      ? await getDatabase()
        .selectFrom('order_items')
        .leftJoin('products', 'products.id', 'order_items.product_id')
        .select([
          'order_items.order_id',
          'order_items.quantity',
          'order_items.order_price',
          'order_items.order_line_total',
          'products.name as product_name',
          'products.sku_code as product_sku',
        ])
        .where('order_items.order_id', 'in', orderIds)
        .orderBy('order_items.created_at', 'asc')
        .execute()
      : []

    const itemsByOrder = new Map<string, typeof items>()
    for (const item of items) {
      const current = itemsByOrder.get(item.order_id) ?? []
      current.push(item)
      itemsByOrder.set(item.order_id, current)
    }

    return {
      customer,
      orders: orders.map((order) => ({
        ...order,
        items: itemsByOrder.get(order.id) ?? [],
      })),
    }
  })

export const saveCustomer = createServerFn({ method: 'POST' })
  .validator(upsertCustomerInput)
  .handler(async ({ data }) => {
    const { ForbiddenError, getDatabase, requireCurrentUser, writeAuditLog } = await getServerDeps()
    const user = await requireCurrentUser({ permissions: ['orders:own', 'orders:all'] })

    if (data.id) {
      const existingCustomer = await getDatabase()
        .selectFrom('customers')
        .select(['id', 'seller_user_id'])
        .where('id', '=', data.id)
        .executeTakeFirst()

      if (!existingCustomer) {
        throw new Error('Customer not found')
      }

      if (!user.permissions.includes('orders:all') && existingCustomer.seller_user_id !== user.id) {
        throw new ForbiddenError()
      }

      const customer = await getDatabase()
        .updateTable('customers')
        .set({
          name: data.name,
          email: data.email ?? null,
          phone: data.phone ?? null,
          address_line: data.addressLine ?? null,
          city: data.city ?? null,
          state: data.state ?? null,
          country: data.country ?? null,
          zip_code: data.zipCode ?? null,
          updated_at: new Date(),
        })
        .where('id', '=', data.id)
        .returning(['id', 'name'])
        .executeTakeFirstOrThrow()

      await writeAuditLog({ actorUserId: user.id, action: 'customer.update', entityTable: 'customers', entityId: customer.id, afterData: customer })
      return customer
    }

    const customer = await getDatabase()
      .insertInto('customers')
      .values({
        seller_user_id: user.id,
        name: data.name,
        email: data.email ?? null,
        phone: data.phone ?? null,
        address_line: data.addressLine ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        country: data.country ?? null,
        zip_code: data.zipCode ?? null,
        created_by_user_id: user.id,
      })
      .returning(['id', 'name'])
      .executeTakeFirstOrThrow()

    await writeAuditLog({ actorUserId: user.id, action: 'customer.create', entityTable: 'customers', entityId: customer.id, afterData: customer })
    return customer
  })
