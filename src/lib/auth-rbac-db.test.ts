import { existsSync } from 'node:fs'
import { Pool, type PoolClient } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

if (existsSync('.env')) {
  process.loadEnvFile('.env')
}

const runDbTests = process.env.DATABASE_URL ? describe : describe.skip

const testRun = `codex-rbac-${Date.now()}`
const leaderId = `${testRun}-leader`
const memberId = `${testRun}-member`
const salesId = `${testRun}-sales`
const externalId = `${testRun}-external`

let pool: Pool
let client: PoolClient
let productId: string

async function visibleOrderNumbers(scope: Array<string>) {
  const result = await client.query(
    `select order_number
     from orders
     where seller_user_id = any($1::text[])
       and order_number like $2
     order by order_number`,
    [scope, `${testRun}%`],
  )

  return result.rows.map((row) => row.order_number)
}

async function visibleCustomerNames(scope: Array<string>) {
  const result = await client.query(
    `select name
     from customers
     where seller_user_id = any($1::text[])
       and name like $2
     order by name`,
    [scope, `${testRun}%`],
  )

  return result.rows.map((row) => row.name)
}

async function visibleStockOwners(scope: Array<string>) {
  const result = await client.query(
    `select distinct user_related_id
     from stock_movements
     where user_related_id = any($1::text[])
       and remark = $2
     order by user_related_id`,
    [scope, testRun],
  )

  return result.rows.map((row) => row.user_related_id)
}

runDbTests('auth/RBAC scoped data integration', () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
    client = await pool.connect()
    await client.query('begin')

    const product = await client.query('select id from products order by created_at desc limit 1')
    productId = product.rows[0]?.id

    if (!productId) {
      throw new Error('A product row is required for RBAC scoped stock tests.')
    }

    await client.query(
      `insert into auth_users (id, name, email, email_verified)
       values
        ($1, 'Leader', $5, true),
        ($2, 'Member', $6, true),
        ($3, 'Sales', $7, true),
        ($4, 'External', $8, true)`,
      [
        leaderId,
        memberId,
        salesId,
        externalId,
        `${leaderId}@example.test`,
        `${memberId}@example.test`,
        `${salesId}@example.test`,
        `${externalId}@example.test`,
      ],
    )

    await client.query(
      'insert into sales_leader_members (leader_user_id, member_user_id, active) values ($1, $2, true)',
      [leaderId, memberId],
    )

    for (const userId of [leaderId, memberId, salesId, externalId]) {
      const customer = await client.query(
        `insert into customers (seller_user_id, name, created_by_user_id)
         values ($1, $2, $1)
         returning id`,
        [userId, `${testRun}-${userId}`],
      )

      await client.query(
        `insert into orders
          (order_number, seller_user_id, customer_id, order_status, payment_status, subtotal_amount, total_amount, item_quantity_total, item_quantity_distinct, created_by_user_id)
         values ($1, $2, $3, 'pending_payment', 'pending', 10, 10, 1, 1, $2)`,
        [`${testRun}-${userId}`, userId, customer.rows[0].id],
      )

      await client.query(
        `insert into stock_movements (movement_type, product_id, user_related_id, quantity, remark, created_by_user_id)
         values ('admin_assign', $1, $2, 10, $3, $2)`,
        [productId, userId, testRun],
      )
    }
  })

  afterAll(async () => {
    if (client) {
      await client.query('rollback')
      client.release()
    }

    if (!pool) return
    await pool.end()
  })

  it('returns only own orders, customers, and stock for a sales user', async () => {
    await expect(visibleOrderNumbers([salesId])).resolves.toEqual([`${testRun}-${salesId}`])
    await expect(visibleCustomerNames([salesId])).resolves.toEqual([`${testRun}-${salesId}`])
    await expect(visibleStockOwners([salesId])).resolves.toEqual([salesId])
  })

  it('returns leader plus member rows, excluding external sales rows', async () => {
    const leaderScope = [leaderId, memberId]

    await expect(visibleOrderNumbers(leaderScope)).resolves.toEqual([
      `${testRun}-${leaderId}`,
      `${testRun}-${memberId}`,
    ])
    await expect(visibleCustomerNames(leaderScope)).resolves.toEqual([
      `${testRun}-${leaderId}`,
      `${testRun}-${memberId}`,
    ])
    await expect(visibleStockOwners(leaderScope)).resolves.toEqual([leaderId, memberId])
  })
})
