import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { profileCsv } from '../src/lib/migration/csv'
import { bubbleSources } from '../src/lib/migration/sources'

process.stdout.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EPIPE') process.exit(0)
  throw error
})

const dir = process.argv[2] ?? 'data-example'
const files = (await readdir(dir)).filter((file) => file.endsWith('.csv')).sort()
const canonicalFiles = new Set(bubbleSources.map((source) => source.canonicalFile))

for (const file of files) {
  const profile = profileCsv(file, await readFile(join(dir, file), 'utf8'))
  const marker = canonicalFiles.has(file) ? 'canonical' : 'variant'
  console.log(`\n${profile.file} (${marker})`)
  console.log(`rows=${profile.rowCount} columns=${profile.columnCount}`)
  console.log(profile.headers.join(' | '))
}

for (const source of bubbleSources.filter((item) => item.canonicalFile.includes('/') || item.variantFiles?.some((file) => file.includes('/')))) {
  for (const file of [source.canonicalFile, ...(source.variantFiles ?? [])].filter((item) => item.includes('/'))) {
    const profile = profileCsv(file, await readFile(file, 'utf8'))
    const marker = source.canonicalFile === file ? 'canonical' : 'variant'
    console.log(`\n${profile.file} (${marker})`)
    console.log(`rows=${profile.rowCount} columns=${profile.columnCount}`)
    console.log(profile.headers.join(' | '))
  }
}
