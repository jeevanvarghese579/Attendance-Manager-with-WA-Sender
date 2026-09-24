// Backup & Restore service.
// Creates a Master Backup for the active profile only, and restores into the
// active profile only. Offline and online data never merge automatically.

import { repo, getMode } from '@/repositories/repo'
import { uid as genId } from '@/utils/ids'
import { validateBackup, detectMergeConflicts } from '@/validation/backup'
import { downloadText } from '@/utils/csv'
import { logInfo } from '@/utils/logger'
import { APP_KEY } from '@/services/firebase/paths'

export const APP_VERSION = '4.0.0'
export const BACKUP_FORMAT_VERSION = 1
export const SCHEMA_VERSION = 1

export async function collectBackupData() {
  const [classes, students, attendance, holidays, holidayOverrides, settings] = await Promise.all([
    repo.listClasses(),
    repo.listStudents(),
    repo.listAttendance(),
    repo.listHolidays(),
    repo.listOverrides(),
    repo.getSettings(),
  ])
  return { classes, students, attendance, holidays, holidayOverrides, settings }
}

export async function createMasterBackup() {
  const data = await collectBackupData()
  const { mode } = getMode()
  const backup = {
    appKey: APP_KEY,
    app: 'attendance-manager-for-schools',
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    createdAt: new Date().toISOString(),
    sourceProfile: mode,
    data,
    counts: {
      classes: data.classes.length,
      students: data.students.length,
      attendance: data.attendance.length,
      holidays: data.holidays.length,
      holidayOverrides: data.holidayOverrides.length,
    },
  }
  const filename = `attendance-master-backup-${new Date().toISOString().slice(0, 10)}.json`
  downloadText(filename, JSON.stringify(backup, null, 2), 'application/json')
  logInfo('Backup created', filename, backup.counts)
  return { filename, counts: backup.counts }
}

export function readBackupFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result)
        const { ok, errors, backup } = validateBackup(obj)
        if (!ok) return reject(new Error(errors.join(' ')))
        resolve(backup)
      } catch (e) {
        reject(new Error('Could not read this backup file. It may be corrupted.'))
      }
    }
    reader.onerror = () => reject(new Error('Could not read the file.'))
    reader.readAsText(file)
  })
}

// Restore mode 1: replace all data in the active profile.
export async function restoreReplace(backup) {
  await repo.replaceAll(backup.data)
  return { mode: 'replace', counts: backup.counts }
}

// Restore mode 2: merge — remap conflicting IDs so existing records are
// never silently overwritten.
export async function restoreMerge(backup) {
  const existing = await collectBackupData()
  const conflicts = detectMergeConflicts(backup, existing)

  // Remap IDs for conflicting classes and cascade to students/attendance.
  const classIdMap = new Map()
  const studentIdMap = new Map()
  const existingClassIds = new Set(existing.classes.map(c => c.id))
  const existingStudentIds = new Set(existing.students.map(s => s.id))

  const newClasses = backup.data.classes.map(c => {
    if (existingClassIds.has(c.id)) {
      const newId = genId()
      classIdMap.set(c.id, newId)
      return { ...c, id: newId }
    }
    return c
  })

  const newStudents = backup.data.students.map(s => {
    const mappedClassId = classIdMap.get(s.classId) || s.classId
    let rec = { ...s, classId: mappedClassId }
    if (existingStudentIds.has(s.id)) {
      const newId = genId()
      studentIdMap.set(s.id, newId)
      rec = { ...rec, id: newId }
    }
    return rec
  })

  const newAttendance = backup.data.attendance.map(a => ({
    ...a,
    studentId: studentIdMap.get(a.studentId) || a.studentId,
    classId: classIdMap.get(a.classId) || a.classId,
  }))

  const mergedData = {
    ...backup.data,
    classes: newClasses,
    students: newStudents,
    attendance: newAttendance,
  }
  await repo.mergeAll(mergedData, { students: newStudents, attendance: newAttendance })
  return { mode: 'merge', counts: backup.counts, conflicts }
}
