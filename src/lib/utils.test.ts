import { describe, expect, it } from 'vitest'
import { formatInternationalPhone, formatMoney, formatNumber, titleCase } from './utils'

describe('format helpers', () => {
  it('formats Malaysian Ringgit amounts', () => {
    expect(formatMoney(289.9)).toBe('RM\u00a0289.90')
  })

  it('formats large counts for dashboard metrics', () => {
    expect(formatNumber(24802)).toBe('24,802')
  })

  it('capitalizes customer display text consistently', () => {
    expect(titleCase('  siti nur aisyah  ')).toBe('Siti Nur Aisyah')
    expect(titleCase('JALAN MERDEKA 12, TAMAN SENTOSA')).toBe('Jalan Merdeka 12, Taman Sentosa')
  })

  it('formats customer phone numbers with supported country prefixes', () => {
    expect(formatInternationalPhone('012-345 6789')).toBe('+60123456789')
    expect(formatInternationalPhone('61412345678')).toBe('+61412345678')
    expect(formatInternationalPhone('9123 4567', 'Singapore')).toBe('+6591234567')
    expect(formatInternationalPhone('7123456', 'Brunei')).toBe('+6737123456')
  })
})
