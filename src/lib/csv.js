export function escapeCsvCell(value) {
  const text = value === null || value === undefined ? '' : String(value)
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

/**
 * Convert an array of objects into CSV.
 * columns: [{ key, label }] — labels are already translated by the caller.
 */
export function toCsv(rows = [], columns = []) {
  const effectiveColumns = columns.length > 0
    ? columns
    : Object.keys(rows[0] ?? {}).map((key) => ({ key, label: key }))
  const header = effectiveColumns.map((column) => escapeCsvCell(column.label)).join(',')
  const body = rows.map((row) => effectiveColumns.map((column) => {
    const value = typeof column.value === 'function' ? column.value(row) : row[column.key]
    return escapeCsvCell(value)
  }).join(','))
  return [header, ...body].join('\r\n')
}

/** Prefix a UTF-8 BOM so Excel opens Swahili/English text correctly. */
export function csvDocument(rows, columns) {
  return `\uFEFF${toCsv(rows, columns)}`
}

export function downloadTextFile(filename, content, mime = 'text/plain;charset=utf-8') {
  if (typeof document === 'undefined') return false
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}
