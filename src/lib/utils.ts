import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: Array<ClassValue>) {
  return twMerge(clsx(inputs))
}

export function formatMoney(amount: number, currency = 'MYR') {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('en-MY').format(value)
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

export function titleCase(value: string | null | undefined) {
  if (!value) return ''

  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b([a-z])/g, (letter) => letter.toUpperCase())
}

export function formatInternationalPhone(value: string | null | undefined, country?: string | null) {
  if (!value) return ''

  const trimmed = value.trim()
  if (!trimmed) return ''

  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return ''

  if (trimmed.startsWith('+')) {
    return `+${digits}`
  }

  if (digits.startsWith('673')) return `+${digits}`
  if (digits.startsWith('61') || digits.startsWith('65')) return `+${digits}`
  if (digits.startsWith('60')) return `+${digits}`

  const normalizedCountry = country?.toLowerCase() ?? ''
  const nationalNumber = digits.replace(/^0+/, '')

  if (/\baustralia\b|\bau\b/.test(normalizedCountry)) return `+61${nationalNumber}`
  if (/\bsingapore\b|\bsg\b/.test(normalizedCountry)) return `+65${nationalNumber}`
  if (/\bbrunei\b|\bbn\b/.test(normalizedCountry)) return `+673${nationalNumber}`

  return `+60${nationalNumber}`
}
