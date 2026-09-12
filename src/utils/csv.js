// CSV import/export utilities for student lists.

export function parseCsv(text) {
  // Strip BOM and normalize line endings.
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rows = []
  let field = ''
  let row = []
  let inQuotes = false

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === '\n') {
      row.push(field); field = ''; rows.push(row); row = []
    } else if (c === ',') {
      row.push(field); field = ''
    } else field += c
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows.filter(r => r.some(c => c.trim() !== ''))
}

function csvEscape(value) {
  const s = String(value ?? '')
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

export function toCsv(rows) {
  return rows.map(r => r.map(csvEscape).join(',')).join('\n')
}

export function downloadText(filename, text, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.addEventListener('click', event => event.stopPropagation())
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Parse a student CSV into validated rows. Returns { rows, errors }.
// rows: { rollNumber, name }[]
export function parseStudentCsv(text) {
  const raw = parseCsv(text)
  if (raw.length === 0) return { rows: [], errors: ['The file is empty.'] }
  const header = raw[0].map(h => h.trim().toLowerCase())
  const rollIdx = header.findIndex(h => h === 'rollnumber' || h === 'roll number' || h === 'roll_no' || h === 'rollno')
  const nameIdx = header.findIndex(h => h === 'name')
  if (rollIdx === -1 || nameIdx === -1) {
    return { rows: [], errors: ['CSV must have "rollNumber" and "name" columns.'] }
  }
  const seen = new Map()
  const rows = []
  const errors = []
  raw.slice(1).forEach((r, i) => {
    const roll = (r[rollIdx] || '').trim()
    const name = (r[nameIdx] || '').trim()
    if (!roll && !name) return
    if (!roll) { errors.push(`Row ${i + 2}: missing roll number.`); return }
    if (!name) { errors.push(`Row ${i + 2}: missing name.`); return }
    if (seen.has(roll)) { errors.push(`Row ${i + 2}: duplicate roll number "${roll}" in file.`); return }
    seen.set(roll, true)
    rows.push({ rollNumber: roll, name })
  })
  return { rows, errors }
}

export function studentsToCsv(students) {
  const sorted = [...students].sort((a, b) => {
    const r = String(a.rollNumber).localeCompare(String(b.rollNumber), undefined, { numeric: true })
    if (r) return r
    return String(a.name).localeCompare(String(b.name))
  })
  const rows = [['rollNumber', 'name']]
  sorted.forEach(s => rows.push([s.rollNumber, s.name]))
  return toCsv(rows)
}

export const BLANK_TEMPLATE = 'rollNumber,name\n'
