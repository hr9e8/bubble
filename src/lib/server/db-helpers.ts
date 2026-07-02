export function countValue(value: string | number | bigint | null | undefined) {
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'number') return value
  if (!value) return 0
  return Number(value)
}
