import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function read(path: string) {
  return readFileSync(join(root, path), 'utf8')
}

describe('stock data correctness', () => {
  it('derives runtime stock balances from the ledger view', () => {
    const source = read('src/lib/stock.functions.ts')

    expect(source).toContain("selectFrom('stock_balance_ledger')")
    expect(source).not.toContain("selectFrom('stock_balances')")
  })

  it('does not expose destructive stock edits in server functions or UI routes', () => {
    const files = [
      'src/lib/stock.functions.ts',
      'src/routes/stock.tsx',
      'src/routes/stock.adjust.tsx',
      'src/routes/stock.receive.tsx',
      'src/routes/stock.transfer.tsx',
      'src/routes/stock.movements.tsx',
      'src/routes/admin.stocks.tsx',
    ]
    const combined = files.map(read).join('\n')

    expect(combined).not.toMatch(/deleteFrom\(['"]stock_/)
    expect(combined).not.toMatch(/updateTable\(['"]stock_(balances|movements|lots)/)
    expect(combined).not.toContain("selectFrom('stock_balances')")
  })
})
