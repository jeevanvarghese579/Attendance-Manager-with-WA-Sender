// Natural sort for roll numbers: handles numeric, alphanumeric, and mixed.

const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

export function naturalCompare(a, b) {
  return naturalCollator.compare(String(a ?? ''), String(b ?? ''))
}

export function sortByRollNumber(list) {
  return [...list].sort((a, b) => {
    const r = naturalCompare(a.rollNumber, b.rollNumber)
    if (r !== 0) return r
    return naturalCompare(a.name, b.name)
  })
}

export function normalizeRoll(n) {
  return String(n ?? '').trim()
}
