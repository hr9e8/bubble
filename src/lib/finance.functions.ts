import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { z } from 'zod'

const assignmentInput = z.object({
  orderId: z.string().uuid(),
  assignedToUserId: z.string().optional(),
})

const decisionInput = z.object({
  orderId: z.string().uuid(),
  remarks: z.string().optional(),
  rejectedReason: z.string().optional(),
  financeHoldReason: z.string().optional(),
})

const orderIdInput = z.object({ orderId: z.string().uuid() })

const getServerDeps = createServerOnlyFn(async () => {
  const [db, authContext] = await Promise.all([
    import('./db/client'),
    import('./server/auth-context'),
  ])

  return { ...db, ...authContext }
})

export const listFinanceQueue = createServerFn({ method: 'GET' }).handler(async () => {
  const { getDatabase, requireCurrentUser } = await getServerDeps()
  await requireCurrentUser({ permissions: ['finance:verify'] })

  return getDatabase()
    .selectFrom('orders')
    .leftJoin('payment_verifications', 'payment_verifications.order_id', 'orders.id')
    .leftJoin('customers', 'customers.id', 'orders.customer_id')
    .select([
      'orders.id',
      'orders.order_number',
      'orders.payment_method',
      'orders.payment_status',
      'orders.total_amount',
      'orders.created_at',
      'payment_verifications.assigned_to_user_id',
      'payment_verifications.status as verification_status',
      'customers.name as customer_name',
    ])
    .where((eb) =>
      eb.or([
        eb('orders.payment_status', 'in', ['pending', 'manual_review']),
        eb('orders.finance_hold', '=', true),
      ]),
    )
    .orderBy('orders.created_at', 'asc')
    .limit(100)
    .execute()
})

export const getFinanceOrderDetail = createServerFn({ method: 'GET' })
  .validator(orderIdInput)
  .handler(async ({ data }) => {
    const { getDatabase, requireCurrentUser } = await getServerDeps()
    await requireCurrentUser({ permissions: ['finance:verify'] })

    const order = await getDatabase()
      .selectFrom('orders')
      .leftJoin('customers', 'customers.id', 'orders.customer_id')
      .leftJoin('payment_verifications', 'payment_verifications.order_id', 'orders.id')
      .select([
        'orders.id',
        'orders.order_number',
        'orders.payment_method',
        'orders.payment_status',
        'orders.order_status',
        'orders.total_amount',
        'orders.finance_hold',
        'orders.finance_hold_reason',
        'customers.name as customer_name',
        'payment_verifications.assigned_to_user_id',
        'payment_verifications.status as verification_status',
        'payment_verifications.remarks',
        'payment_verifications.rejected_reason',
        'payment_verifications.decided_at',
      ])
      .where('orders.id', '=', data.orderId)
      .executeTakeFirst()

    if (!order) return null

    const [proofs, auditTrail] = await Promise.all([
      getDatabase()
        .selectFrom('order_payment_proofs')
        .leftJoin('files', 'files.id', 'order_payment_proofs.file_id')
        .select([
          'order_payment_proofs.id',
          'order_payment_proofs.proof_type',
          'order_payment_proofs.created_at',
          'files.public_url',
          'files.original_filename',
          'files.mime_type',
        ])
        .where('order_payment_proofs.order_id', '=', data.orderId)
        .orderBy('order_payment_proofs.created_at', 'desc')
        .execute(),
      getDatabase()
        .selectFrom('audit_logs')
        .select(['id', 'action', 'actor_user_id', 'after_data', 'created_at'])
        .where('entity_table', 'in', ['payment_verifications', 'orders'])
        .where((eb) =>
          eb.or([
            eb('entity_id', '=', data.orderId),
            eb('after_data', '@>', JSON.stringify({ order_id: data.orderId })),
          ]),
        )
        .orderBy('created_at', 'desc')
        .limit(30)
        .execute(),
    ])

    return { order, proofs, auditTrail }
  })

export const assignFinanceVerification = createServerFn({ method: 'POST' })
  .validator(assignmentInput)
  .handler(async ({ data }) => {
    const { getDatabase, requireCurrentUser, writeAuditLog } = await getServerDeps()
    const user = await requireCurrentUser({ permissions: ['finance:verify'] })

    const verification = await getDatabase()
      .insertInto('payment_verifications')
      .values({
        order_id: data.orderId,
        assigned_to_user_id: data.assignedToUserId ?? user.id,
        queue_owner_user_id: user.id,
        status: 'assigned',
      })
      .onConflict((oc) =>
        oc.column('order_id').doUpdateSet({
          assigned_to_user_id: data.assignedToUserId ?? user.id,
          queue_owner_user_id: user.id,
          status: 'assigned',
          updated_at: new Date(),
        }),
      )
      .returning(['id', 'order_id', 'assigned_to_user_id', 'status'])
      .executeTakeFirstOrThrow()

    await writeAuditLog({ actorUserId: user.id, action: 'finance.assign', entityTable: 'payment_verifications', entityId: verification.id, afterData: verification })
    return verification
  })

export const verifyPayment = createServerFn({ method: 'POST' })
  .validator(decisionInput)
  .handler(async ({ data }) => recordFinanceDecision(data.orderId, 'verified', data.remarks))

export const rejectPayment = createServerFn({ method: 'POST' })
  .validator(decisionInput)
  .handler(async ({ data }) => recordFinanceDecision(data.orderId, 'rejected', data.remarks, data.rejectedReason))

export const holdPayment = createServerFn({ method: 'POST' })
  .validator(decisionInput)
  .handler(async ({ data }) => recordFinanceDecision(data.orderId, 'finance_hold', data.remarks, undefined, data.financeHoldReason))

async function recordFinanceDecision(
  orderId: string,
  status: 'verified' | 'rejected' | 'finance_hold',
  remarks?: string,
  rejectedReason?: string,
  financeHoldReason?: string,
) {
  const { getDatabase, requireCurrentUser, writeAuditLog } = await getServerDeps()
  const user = await requireCurrentUser({ permissions: ['finance:verify'] })
  const now = new Date()

  const verification = await getDatabase()
    .insertInto('payment_verifications')
    .values({
      order_id: orderId,
      assigned_to_user_id: user.id,
      queue_owner_user_id: user.id,
      status,
      decision: status,
      remarks: remarks ?? null,
      rejected_reason: rejectedReason ?? null,
      finance_hold_reason: financeHoldReason ?? null,
      verified_by_user_id: status === 'verified' ? user.id : null,
      verified_at: status === 'verified' ? now : null,
      decided_at: now,
    })
    .onConflict((oc) =>
      oc.column('order_id').doUpdateSet({
        status,
        decision: status,
        remarks: remarks ?? null,
        rejected_reason: rejectedReason ?? null,
        finance_hold_reason: financeHoldReason ?? null,
        verified_by_user_id: status === 'verified' ? user.id : null,
        verified_at: status === 'verified' ? now : null,
        decided_at: now,
        updated_at: now,
      }),
    )
    .returning(['id', 'order_id', 'status', 'decision'])
    .executeTakeFirstOrThrow()

  await getDatabase()
    .updateTable('orders')
    .set({
      payment_status: status === 'verified' ? 'verified' : status,
      order_status: status === 'verified' ? 'verified' : status,
      finance_hold: status === 'finance_hold',
      finance_hold_reason: financeHoldReason ?? null,
      manually_processed_at: now,
      updated_at: now,
    })
    .where('id', '=', orderId)
    .execute()

  await writeAuditLog({ actorUserId: user.id, action: `finance.${status}`, entityTable: 'payment_verifications', entityId: verification.id, afterData: verification })
  return verification
}
