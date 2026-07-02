import { processWooCommerceSyncJobs } from '../src/lib/woocommerce.functions'

const limitArg = process.argv.find((arg) => arg.startsWith('--limit='))
const storeArg = process.argv.find((arg) => arg.startsWith('--store='))

const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : 1
const storeId = storeArg?.slice('--store='.length)

if (!Number.isInteger(limit) || limit < 1 || limit > 10) {
  throw new Error('--limit must be an integer from 1 to 10.')
}

const result = await processWooCommerceSyncJobs({ storeId, limit })
console.log(JSON.stringify(result, null, 2))
