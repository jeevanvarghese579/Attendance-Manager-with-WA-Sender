// Validation for backup JSON (treated as untrusted) and student CSV imports.

import { normalizeRoll } from '@/utils/sort'
import { APP_KEY } from '@/services/firebase/paths'

export function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim() !== ''
}

export function isISODate(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v))
}

export function validateStudent({ rollNumber, name }) {
  const r = normalizeRoll(rollNumber)
  const n = (name || '').trim()
  if (!r) return 'Roll number is required.'
  if (!n) return 'Name is required.'
  return null
}

// Validate a backup object structure. Returns { ok, errors, backup }.
export function validateBackup(raw) {
  const errors = []
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['Backup is not a valid object.'], backup: null }
  if (raw.app !== 'attendance-manager-for-schools') errors.push('This is not an Attendance Manager backup file.')
  if (raw.appKey !== undefined && raw.appKey !== APP_KEY) errors.push('This backup belongs to a different application.')
  if (typeof raw.formatVersion !== 'number') errors.push('Missing backup format version.')
  if (!raw.data || typeof raw.data !== 'object') { errors.push('Missing data section.'); return { ok: false, errors, backup: null } }

  const d = raw.data
  const checkArr = (key, fn) => {
    if (!Array.isArray(d[key])) { errors.push(`Section "${key}" must be a list.`); return [] }
    d[key].forEach((item, i) => {
      const err = fn?.(item)
      if (err) errors.push(`"${key}" #${i + 1}: ${err}`)
    })
    return d[key]
  }

  checkArr('classes', (c) => (!isNonEmptyString(c?.id) || !isNonEmptyString(c?.name)) ? 'class needs id and name' : null)
  checkArr('students', (s) => {
    if (!isNonEmptyString(s?.id) || !isNonEmptyString(s?.classId) || !isNonEmptyString(s?.rollNumber)) return 'student needs id, classId, rollNumber'
    if (s.attendanceStartDate != null && !isISODate(s.attendanceStartDate)) return 'attendanceStartDate must be a valid date'
    return null
  })
  checkArr('attendance', (a) => (!isNonEmptyString(a?.id) || !isNonEmptyString(a?.studentId) || !isISODate(a?.date)) ? 'attendance needs id, studentId, date' : null)
  checkArr('holidays', (h) => !isISODate(h?.date) ? 'holiday needs valid date' : null)
  checkArr('holidayOverrides', (h) => !isISODate(h?.date) ? 'override needs valid date' : null)

  if (d.settings && typeof d.settings !== 'object') errors.push('settings must be an object.')

  return { ok: errors.length === 0, errors, backup: raw }
}

// Detect conflicts when merging a backup into existing data.
export function detectMergeConflicts(backup, existing) {
  const conflicts = []
  const existingClassIds = new Set(existing.classes.map(c => c.id))
  const existingStudentKeys = new Set(existing.students.map(s => `${s.classId}::${s.rollNumber}`))
  const existingStudentIds = new Set(existing.students.map(s => s.id))
  const existingAttKeys = new Set(existing.attendance.map(a => `${a.studentId}::${a.date}`))

  backup.data.classes.forEach(c => {
    if (existingClassIds.has(c.id)) conflicts.push({ type: 'class', id: c.id, label: c.name })
  })
  backup.data.students.forEach(s => {
    if (existingStudentIds.has(s.id)) conflicts.push({ type: 'student-id', id: s.id, label: `${s.name} (${s.rollNumber})` })
    else if (existingStudentKeys.has(`${s.classId}::${s.rollNumber}`)) conflicts.push({ type: 'roll', label: `Roll ${s.rollNumber} in class ${s.classId}` })
  })
  backup.data.attendance.forEach(a => {
    if (existingAttKeys.has(`${a.studentId}::${a.date}`)) conflicts.push({ type: 'attendance', label: `${a.studentId} @ ${a.date}` })
  })
  return conflicts
}
