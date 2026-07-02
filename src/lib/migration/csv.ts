import { parse } from 'csv-parse/sync'

export type CsvProfile = {
  file: string
  rowCount: number
  columnCount: number
  headers: Array<string>
  filledCounts: Record<string, number>
  sampleValues: Record<string, string>
}

export function parseCsv(text: string) {
  return parse(text, {
    bom: true,
    columns: true,
    relax_column_count: true,
    skip_empty_lines: true,
  }) as Array<Record<string, string>>
}

export function profileCsv(file: string, text: string): CsvProfile {
  const rows = parseCsv(text)
  const headers = rows[0] ? Object.keys(rows[0]) : []
  const filledCounts: Record<string, number> = {}
  const sampleValues: Record<string, string> = {}

  for (const header of headers) {
    filledCounts[header] = 0
    sampleValues[header] = ''

    for (const row of rows) {
      const value = String(row[header] ?? '').trim()
      if (!value) continue

      filledCounts[header] += 1
      if (!sampleValues[header]) {
        sampleValues[header] = value.slice(0, 120)
      }
    }
  }

  return {
    file,
    rowCount: rows.length,
    columnCount: headers.length,
    headers,
    filledCounts,
    sampleValues,
  }
}
