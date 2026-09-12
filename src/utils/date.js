// Date helpers. We treat dates as plain 'YYYY-MM-DD' strings everywhere to
// avoid timezone drift. Calendar display uses local time.

export const MS_PER_DAY = 86400000

export function toDateKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromDateKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayKey() {
  return toDateKey(new Date())
}

export function formatLongDate(key) {
  const d = fromDateKey(key)
  return d.toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

export function formatShortDate(key) {
  const d = fromDateKey(key)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${d.getFullYear()}`
}

// Convert a JS Date to the key of the first day of its month.
export function monthKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function monthKeyFromYM(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

export function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function monthLabelShort(year, month) {
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}

export function monthName(month) {
  return new Date(2000, month, 1).toLocaleDateString(undefined, { month: 'long' })
}

export function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

export function eachDayKeyOfMonth(year, month) {
  const n = daysInMonth(year, month)
  const out = []
  for (let i = 1; i <= n; i++) out.push(toDateKey(new Date(year, month, i)))
  return out
}

export function isWeekend(key, dow) {
  const d = fromDateKey(key).getDay()
  if (dow === 6) return d === 6
  if (dow === 0) return d === 0
  return false
}

export function compareDateKey(a, b) {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

export function dateInRange(key, startKey, endKey) {
  if (startKey && key < startKey) return false
  if (endKey && key > endKey) return false
  return true
}

// Iterate months [start, end] inclusive as {year, month}.
export function eachMonthInRange(startKey, endKey) {
  if (!startKey || !endKey) return []
  const s = fromDateKey(startKey)
  const e = fromDateKey(endKey)
  const out = []
  let y = s.getFullYear()
  let m = s.getMonth()
  while (y < e.getFullYear() || (y === e.getFullYear() && m <= e.getMonth())) {
    out.push({ year: y, month: m })
    m++
    if (m > 11) { m = 0; y++ }
  }
  return out
}

export function addDays(key, n) {
  return toDateKey(new Date(fromDateKey(key).getTime() + n * MS_PER_DAY))
}
