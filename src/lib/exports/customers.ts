import ExcelJS from 'exceljs'
import { formatMoney } from '../utils'

export type CustomerExportRow = {
  name: string
  email: string
  phone: string
  address: string
  sellers: string
  lifetimeValue: number
  lifetimeOrders: number
  lastOrderDate: Date | string | null
}

const customerColumns = [
  { header: 'Name', key: 'name', width: 28 },
  { header: 'Email', key: 'email', width: 30 },
  { header: 'Phone', key: 'phone', width: 18 },
  { header: 'Address', key: 'address', width: 44 },
  { header: 'Sellers', key: 'sellers', width: 36 },
  { header: 'LTV (RM)', key: 'lifetimeValue', width: 16 },
  { header: 'Lifetime Orders', key: 'lifetimeOrders', width: 18 },
  { header: 'Last Order Date', key: 'lastOrderDate', width: 18 },
]

function formatDate(value: Date | string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function csvCell(value: string | number) {
  const text = String(value)
  if (/^[=\-@]/.test(text)) return `"${`'${text}`.replace(/"/g, '""')}"`
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function buildCustomerCsv(rows: Array<CustomerExportRow>) {
  const header = customerColumns.map((column) => csvCell(column.header)).join(',')
  const body = rows.map((row) => [
    row.name,
    row.email,
    row.phone,
    row.address,
    row.sellers,
    row.lifetimeValue.toFixed(2),
    row.lifetimeOrders,
    formatDate(row.lastOrderDate),
  ].map(csvCell).join(','))

  return [header, ...body].join('\n')
}

export async function buildCustomerWorkbook(rows: Array<CustomerExportRow>) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Bubble Rebuild'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Customers')
  sheet.columns = customerColumns

  for (const row of rows) {
    sheet.addRow({
      ...row,
      lifetimeValue: formatMoney(row.lifetimeValue),
      lastOrderDate: formatDate(row.lastOrderDate),
    })
  }

  sheet.getRow(1).font = { bold: true }
  sheet.views = [{ state: 'frozen', ySplit: 1 }]

  return workbook.xlsx.writeBuffer()
}
