import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { Pool } from 'pg'
import { loadLocalEnv } from './load-env'

loadLocalEnv()
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is required to run migrations.')
}

const pool = new Pool({ connectionString })

try {
  await pool.query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())')

  const migrations = (await readdir(join(process.cwd(), 'db', 'migrations')))
    .filter((name) => name.endsWith('.sql'))
    .sort()

  for (const name of migrations) {
    const existing = await pool.query('select 1 from schema_migrations where name = $1', [name])
    if (existing.rowCount) {
      console.log(`Skipping ${name}`)
      continue
    }

    const sql = await readFile(join(process.cwd(), 'db', 'migrations', name), 'utf8')
    await pool.query('begin')
    try {
      await pool.query(sql)
      await pool.query('insert into schema_migrations (name) values ($1)', [name])
      await pool.query('commit')
      console.log(`Applied ${name}`)
    } catch (error) {
      await pool.query('rollback')
      throw error
    }
  }
} finally {
  await pool.end()
}
