import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { hasPermission } from './business-rules'
import { isUserIdWithinScope } from './server/sales-scope'

const root = process.cwd()

function read(path: string) {
  return readFileSync(join(root, path), 'utf8')
}

describe('auth/RBAC direct-call contracts', () => {
  it('guards private server functions against unauthenticated direct calls', () => {
    for (const path of [
      'src/lib/orders.functions.ts',
      'src/lib/customers.functions.ts',
      'src/lib/stock.functions.ts',
      'src/lib/finance.functions.ts',
      'src/lib/warehouse.functions.ts',
    ]) {
      expect(read(path), path).toContain('requireCurrentUser')
    }
  })

  it('rejects wrong-role permissions for protected workflows', () => {
    expect(hasPermission(['sales_team'], 'finance:verify')).toBe(false)
    expect(hasPermission(['sales_team'], 'warehouse:fulfill')).toBe(false)
    expect(hasPermission(['warehouse_manager'], 'orders:own')).toBe(false)
    expect(hasPermission(['finance'], 'stock:warehouse')).toBe(false)
  })

  it('allows sales own-scope reads only for their own records', () => {
    const ownScope = ['sales-own']

    expect(isUserIdWithinScope('sales-own', ownScope)).toBe(true)
    expect(isUserIdWithinScope('other-sales', ownScope)).toBe(false)
    expect(isUserIdWithinScope(null, ownScope)).toBe(false)
  })

  it('allows sales-leader team-scope reads for orders, customers, and stock owners', () => {
    const teamScope = ['leader', 'sales-member-a', 'sales-member-b']

    expect(isUserIdWithinScope('leader', teamScope)).toBe(true)
    expect(isUserIdWithinScope('sales-member-a', teamScope)).toBe(true)
    expect(isUserIdWithinScope('external-sales', teamScope)).toBe(false)
  })
})
