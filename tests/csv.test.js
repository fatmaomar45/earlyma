import { describe, it, expect } from 'vitest'
import { csvDocument, escapeCsvCell, toCsv } from '../src/lib/csv.js'

describe('CSV export', () => {
  it('escapes commas, quotes and newlines', () => {
    expect(escapeCsvCell('plain')).toBe('plain')
    expect(escapeCsvCell(null)).toBe('')
    expect(escapeCsvCell('a,b')).toBe('"a,b"')
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""')
    expect(escapeCsvCell('line\nbreak')).toBe('"line\nbreak"')
    expect(escapeCsvCell(42)).toBe('42')
  })

  it('builds a CRLF CSV with translated labels', () => {
    const rows = [
      { name: 'Amina', village: 'Alpha' },
      { name: 'Baby, One', village: 'Beta' },
    ]
    const csv = toCsv(rows, [
      { key: 'name', label: 'Name' },
      { key: 'village', label: 'Village' },
    ])
    expect(csv.split('\r\n')).toEqual([
      'Name,Village',
      'Amina,Alpha',
      '"Baby, One",Beta',
    ])
  })

  it('derives columns from the first row when none are provided', () => {
    expect(toCsv([{ a: 1, b: 2 }])).toBe('a,b\r\n1,2')
    expect(toCsv([])).toBe('')
  })

  it('supports computed column values', () => {
    const csv = toCsv([{ first: 'A', last: 'B' }], [
      { label: 'Full name', value: (row) => `${row.first} ${row.last}` },
    ])
    expect(csv).toBe('Full name\r\nA B')
  })

  it('prefixes a UTF-8 BOM for spreadsheet applications', () => {
    const document = csvDocument([{ a: 1 }], [{ key: 'a', label: 'A' }])
    expect(document.charCodeAt(0)).toBe(0xFEFF)
    expect(document.slice(1)).toBe('A\r\n1')
  })
})
