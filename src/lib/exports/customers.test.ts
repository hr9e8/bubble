import { describe, expect, it } from 'vitest'
import { buildCustomerCsv, buildCustomerWorkbook } from './customers'

const rows = [
  {
    name: 'Nur Aisyah',
    email: 'aisyah@example.test',
    phone: '+60123456789',
    address: 'Jalan Merdeka, Shah Alam, Selangor, Malaysia, 40000',
    sellers: 'Aina Sales, Farid Sales',
    lifetimeValue: 489.9,
    lifetimeOrders: 3,
    lastOrderDate: new Date('2026-06-29T00:00:00.000Z'),
  },
]

describe('customer exports', () => {
  it('creates CSV content with customer metrics', () => {
    const csv = buildCustomerCsv(rows)

    expect(csv).toContain('LTV (RM)')
    expect(csv).toContain('+60123456789')
    expect(csv).toContain('489.90')
  })

  it('creates a non-empty XLSX buffer', async () => {
    const result = await buildCustomerWorkbook(rows)

    expect(result.byteLength).toBeGreaterThan(1000)
  })
})
