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

const exportCustomersInput = z.object({
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

async function loadCustomerRows(input?: { query?: string; limit?: number }) {
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
    .orderBy('customers.created_at', 'desc')

  if (input?.query) {
    query = query.where((eb) =>
      eb.or([
        eb('customers.name', 'ilike', `%${input.query}%`),
        eb('customers.email', 'ilike', `%${input.query}%`),
        eb('customers.phone', 'ilike', `%${input.query}%`),
      ]),
    )
  }

  if (scopedUserIds != null) {
    query = query.where((eb) =>
      eb.or([
        eb('customers.seller_user_id', 'in', scopedUserIds),
        eb('order_metrics.customer_id', 'is not', null),
      ]),
    )
  }

  if (input?.limit) {
    query = query.limit(input.limit)
  }

  return query.execute()
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

export const exportCustomers = createServerFn({ method: 'POST' })
  .validator(exportCustomersInput)
  .handler(async ({ data }) => {
    const rows = (await loadCustomerRows()).map(exportRow)
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
        sql<string>`coalesce(order_metrics.seller_names, customers.seller_user_id, '')`.as('seller_names'),
      ])
      .where('customers.id', '=', data.customerId)
      .executeTakeFirst()

    if (!customer) return null
    if (!isUserIdWithinScope(customer.seller_user_id, scopedUserIds) && !customer.scoped_order_customer_id) {
      throw new ForbiddenError()
    }

    return customer
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
