import { createServerFn } from '@tanstack/react-start'
import { countValue } from './server/db-helpers'

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function monthLabel(date: Date) {
  return date.toLocaleDateString('en-MY', {
    month: 'short',
    timeZone: 'UTC',
  })
}

export const getDashboardMetrics = createServerFn({ method: 'GET' }).handler(async () => {
  const [{ getDatabase }, { requireCurrentUser }, { getOrderScopeUserIds }] = await Promise.all([
    import('./db/client'),
    import('./server/auth-context'),
    import('./server/sales-scope'),
  ])
  const user = await requireCurrentUser()
  const scopedUserIds = await getOrderScopeUserIds(user)

  let ordersCountQuery = getDatabase().selectFrom('orders').select((eb) => eb.fn.countAll().as('count'))
  let customersCountQuery = getDatabase().selectFrom('customers').select((eb) => eb.fn.countAll().as('count'))
  let pipelineQuery = getDatabase()
    .selectFrom('orders')
    .select(['order_status', (eb) => eb.fn.countAll().as('count')])
    .groupBy('order_status')
  let monthlyOrdersQuery = getDatabase()
    .selectFrom('orders')
    .select(['created_at', 'total_amount'])
    .where('created_at', '>=', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000))

  if (scopedUserIds != null) {
    ordersCountQuery = ordersCountQuery.where('seller_user_id', 'in', scopedUserIds)
    customersCountQuery = customersCountQuery.where('seller_user_id', 'in', scopedUserIds)
    pipelineQuery = pipelineQuery.where('seller_user_id', 'in', scopedUserIds)
    monthlyOrdersQuery = monthlyOrdersQuery.where('seller_user_id', 'in', scopedUserIds)
  }

  const [ordersCount, customersCount, pipelineRows, monthlyOrders, pendingFinance, readyToPack] = await Promise.all([
    ordersCountQuery.executeTakeFirst(),
    customersCountQuery.executeTakeFirst(),
    pipelineQuery.execute(),
    monthlyOrdersQuery.execute(),
    user.permissions.includes('finance:verify')
      ? getDatabase()
          .selectFrom('orders')
          .select((eb) => eb.fn.countAll().as('count'))
          .where((eb) =>
            eb.or([
              eb('payment_status', 'in', ['pending', 'manual_review']),
              eb('finance_hold', '=', true),
            ]),
          )
          .executeTakeFirst()
      : Promise.resolve(null),
    user.permissions.includes('warehouse:fulfill')
      ? getDatabase()
          .selectFrom('orders')
          .select((eb) => eb.fn.countAll().as('count'))
          .where('order_status', 'in', ['verified', 'packing'])
          .executeTakeFirst()
      : Promise.resolve(null),
  ])

  const now = new Date()
  const monthlyBuckets = Array.from({ length: 6 }, (_, index) => {
    const bucketDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - index), 1))
    return {
      key: monthKey(bucketDate),
      month: monthLabel(bucketDate),
      revenue: 0,
    }
  })

  const monthIndex = new Map(monthlyBuckets.map((bucket, index) => [bucket.key, index]))

  for (const row of monthlyOrders) {
    const key = monthKey(new Date(row.created_at))
    const index = monthIndex.get(key)
    if (index == null) continue
    monthlyBuckets[index]!.revenue += Number(row.total_amount ?? 0)
  }

  return {
    currentUser: {
      id: user.id,
      name: user.name,
      permissions: user.permissions,
      roles: user.roles,
      scope: scopedUserIds == null ? 'all' : scopedUserIds.length > 1 ? 'team' : 'own',
    },
    customers: countValue(customersCount?.count),
    monthlySales: monthlyBuckets,
    orderPipeline: pipelineRows.map((row) => ({
      count: countValue(row.count),
      status: row.order_status,
    })),
    orders: countValue(ordersCount?.count),
    pendingFinance: countValue(pendingFinance?.count),
    readyToPack: countValue(readyToPack?.count),
  }
})
