import { describe, expect, it } from 'vitest'
import { parseCsv, profileCsv } from './csv'
import { splitBubbleList } from './sources'

describe('Bubble CSV helpers', () => {
  it('parses quoted values with embedded newlines', () => {
    const rows = parseCsv('"Name","Description"\n"VEG","Line 1\nLine 2"\n')

    expect(rows).toEqual([{ Name: 'VEG', Description: 'Line 1\nLine 2' }])
  })

  it('profiles filled counts and samples', () => {
    const profile = profileCsv('sample.csv', '"Name","Email"\n"Aina",""\n"Farid","farid@example.test"\n')

    expect(profile.rowCount).toBe(2)
    expect(profile.filledCounts).toEqual({ Name: 2, Email: 1 })
    expect(profile.sampleValues.Email).toBe('farid@example.test')
  })

  it('splits Bubble list fields', () => {
    expect(splitBubbleList('a , b, c')).toEqual(['a', 'b', 'c'])
  })
})
