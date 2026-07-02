import { describe, expect, it } from 'vitest'
import {
  calculateOrderTotal,
  hasPermission,
  matchShippingRate,
  parseBubbleDate,
  parseMoney,
  signedStockQuantity,
} from './business-rules'
import { splitBubbleList } from './migration/sources'

describe('business rules', () => {
  it('parses money-like Bubble values', () => {
    expect(parseMoney('RM 1,240.50')).toBe(1240.5)
    expect(parseMoney('')).toBe(0)
    expect(parseMoney(undefined)).toBe(0)
  })

  it('parses valid Bubble dates and rejects invalid dates', () => {
    expect(parseBubbleDate('2024-02-03T10:15:00Z')?.toISOString()).toBe('2024-02-03T10:15:00.000Z')
    expect(parseBubbleDate('not-a-date')).toBeNull()
  })

  it('splits Bubble list fields without empty tokens', () => {
    expect(splitBubbleList('a, b,,c')).toEqual(['a', 'b', 'c'])
  })

  it('matches the first active shipping rate by total and weight range', () => {
    const rate = matchShippingRate(
      [
        { active: false, totalMin: 0, totalMax: 1000, weightMaxKg: 10, price: 99 },
        { active: true, totalMin: 100, totalMax: 300, weightMinKg: 0, weightMaxKg: 2, price: 8 },
        { active: true, totalMin: 300, totalMax: 900, weightMinKg: 0, weightMaxKg: 10, price: 15 },
      ],
      { orderSubtotal: 180, weightKg: 1.4 },
    )

    expect(rate?.price).toBe(8)
  })

  it('calculates order totals with fees and discounts', () => {
    expect(
      calculateOrderTotal({
        itemsSubtotal: 100,
        shippingTotal: 8,
        codFee: 3.5,
        transactionFee: 1.25,
        discountAmount: 10,
      }),
    ).toEqual({
      subtotal: 100,
      shipping: 8,
      codFee: 3.5,
      transactionFee: 1.25,
      discount: 10,
      total: 102.75,
    })
  })

  it('signs stock movements from business intent', () => {
    expect(signedStockQuantity('admin_assign', 12)).toBe(12)
    expect(signedStockQuantity('order_reserve', 12)).toBe(-12)
    expect(() => signedStockQuantity('warehouse_receive', 0)).toThrow('non-zero')
  })

  it('resolves RBAC permissions from role grants', () => {
    expect(hasPermission(['sales_team'], 'orders:own')).toBe(true)
    expect(hasPermission(['sales_team'], 'orders:all')).toBe(false)
    expect(hasPermission(['finance'], 'orders:all', ['orders:all'])).toBe(true)
  })
})
