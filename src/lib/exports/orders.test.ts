import { describe, expect, it } from 'vitest'
import { buildOrderWorkbook } from './orders'

describe('buildOrderWorkbook', () => {
  it('creates a non-empty XLSX buffer', async () => {
    const result = await buildOrderWorkbook([
      {
        orderNumber: 'ORD-1',
        createdAt: new Date('2026-06-29T00:00:00.000Z'),
        sellerName: 'Aina Sales',
        customerName: 'Nur Aisyah',
        paymentStatus: 'verified',
        fulfillmentStatus: 'packing',
        totalAmount: 289.9,
        trackingNumber: null,
      },
    ])

    expect(result.byteLength).toBeGreaterThan(1000)
  })
})
