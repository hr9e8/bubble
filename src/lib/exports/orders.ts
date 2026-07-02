import ExcelJS from 'exceljs'
import { formatMoney } from '../utils'

export type OrderExportRow = {
  orderNumber: string
  createdAt: Date
  sellerName: string
  customerName: string
  paymentStatus: string
  fulfillmentStatus: string
  totalAmount: number
  trackingNumber?: string | null
}

export async function buildOrderWorkbook(rows: Array<OrderExportRow>) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Bubble Rebuild'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Orders')
  sheet.columns = [
    { header: 'Order ID', key: 'orderNumber', width: 18 },
    { header: 'Created At', key: 'createdAt', width: 20 },
    { header: 'Seller', key: 'sellerName', width: 24 },
    { header: 'Customer', key: 'customerName', width: 28 },
    { header: 'Payment', key: 'paymentStatus', width: 18 },
    { header: 'Fulfillment', key: 'fulfillmentStatus', width: 18 },
    { header: 'Total', key: 'totalAmount', width: 16 },
    { header: 'Tracking No', key: 'trackingNumber', width: 24 },
  ]

  for (const row of rows) {
    sheet.addRow({
      ...row,
      createdAt: row.createdAt.toISOString(),
      totalAmount: formatMoney(row.totalAmount),
    })
  }

  sheet.getRow(1).font = { bold: true }
  sheet.views = [{ state: 'frozen', ySplit: 1 }]

  return workbook.xlsx.writeBuffer()
}
