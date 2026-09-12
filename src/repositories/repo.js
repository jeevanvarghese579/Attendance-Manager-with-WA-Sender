// Unified repository — the single API the app uses for data access.
// Routes every call to either the Firestore (online) or Dexie (offline) repo
// based on the current mode. UI code never talks to Firestore or Dexie directly.

import { offlineRepo } from '@/services/indexeddb/offlineRepo'
import { onlineRepo } from '@/services/firestore/onlineRepo'
import { withLogging } from '@/services/firestore/onlineRepo'
import { logError } from '@/utils/logger'

let currentMode = 'offline' // 'online' | 'offline'
let currentUid = null

export function setMode(mode, uid = null) {
  currentMode = mode
  currentUid = uid
}

export function getMode() {
  return { mode: currentMode, uid: currentUid }
}

function wrap(operation, collection, recordId, fn) {
  if (currentMode === 'online') {
    if (!currentUid) throw new Error('Not signed in.')
    return withLogging(currentUid, operation, collection, recordId, fn)
  }
  // Offline: log with uid 'offline' for consistency.
  return fn().catch((error) => {
    logError({ uid: 'offline', operation, collection, recordId, error })
    throw error
  })
}

export const repo = {
  // ---- Classes ----
  listClasses: () => wrap('list', 'classes', null, () =>
    currentMode === 'online' ? onlineRepo.listClasses(currentUid) : offlineRepo.listClasses()),

  putClass: (c) => wrap('put', 'classes', c.id, async () =>
    currentMode === 'online' ? onlineRepo.putClass(currentUid, c) : offlineRepo.putClass(c)),

  deleteClass: (id) => wrap('delete', 'classes', id, async () =>
    currentMode === 'online' ? onlineRepo.deleteClass(currentUid, id) : offlineRepo.deleteClass(id)),

  // ---- Students ----
  listStudents: (classId) => wrap('list', 'students', null, () =>
    currentMode === 'online' ? onlineRepo.listStudents(currentUid, classId) : offlineRepo.listStudents(classId)),

  putStudent: (s) => wrap('put', 'students', s.id, async () =>
    currentMode === 'online' ? onlineRepo.putStudent(currentUid, s) : offlineRepo.putStudent(s)),

  bulkUpdateStudentRollNumbers: ({ classId, updates }) => wrap('bulk-update-rolls', 'students', classId, async () =>
    currentMode === 'online'
      ? onlineRepo.bulkUpdateStudentRollNumbers(currentUid, { classId, updates })
      : offlineRepo.bulkUpdateStudentRollNumbers({ classId, updates })),

  deleteStudent: (id) => wrap('delete', 'students', id, async () =>
    currentMode === 'online' ? onlineRepo.deleteStudent(currentUid, id) : offlineRepo.deleteStudent(id)),

  rollExists: (classId, rollNumber, exceptId) => wrap('check', 'students', null, () =>
    currentMode === 'online' ? onlineRepo.rollExists(currentUid, classId, rollNumber, exceptId) : offlineRepo.rollExists(classId, rollNumber, exceptId)),

  // ---- Attendance ----
  listAttendance: () => wrap('list', 'attendance', null, () =>
    currentMode === 'online' ? onlineRepo.listAttendance(currentUid) : offlineRepo.listAttendance()),

  attendanceForStudent: (studentId) => wrap('list', 'attendance', studentId, () =>
    currentMode === 'online' ? onlineRepo.attendanceForStudent(currentUid, studentId) : offlineRepo.attendanceForStudent(studentId)),

  setStudentAttendance: ({ studentId, classId, dates }) => wrap('set', 'attendance', studentId, async () => {
    if (currentMode === 'online') await onlineRepo.setStudentAttendance({ uid: currentUid, studentId, classId, dates })
    else await offlineRepo.setStudentAttendance({ studentId, classId, dates })
  }),

  setTodayAbsentees: ({ classId, studentIds, date }) => wrap('set', 'attendance', null, async () => {
    if (currentMode === 'online') await onlineRepo.setTodayAbsentees({ uid: currentUid, classId, studentIds, date })
    else await offlineRepo.setTodayAbsentees({ classId, studentIds, date })
  }),

  // ---- Holidays ----
  listHolidays: () => wrap('list', 'holidays', null, () =>
    currentMode === 'online' ? onlineRepo.listHolidays(currentUid) : offlineRepo.listHolidays()),

  setHolidays: (dates) => wrap('set', 'holidays', null, async () =>
    currentMode === 'online' ? onlineRepo.setHolidays(currentUid, dates) : offlineRepo.setHolidays(dates)),

  // ---- Overrides ----
  listOverrides: () => wrap('list', 'holidayOverrides', null, () =>
    currentMode === 'online' ? onlineRepo.listOverrides(currentUid) : offlineRepo.listOverrides()),

  setOverrides: (dates) => wrap('set', 'holidayOverrides', null, async () =>
    currentMode === 'online' ? onlineRepo.setOverrides(currentUid, dates) : offlineRepo.setOverrides(dates)),

  // ---- Settings ----
  getSettings: () => wrap('get', 'settings', 'app', () =>
    currentMode === 'online' ? onlineRepo.getSettings(currentUid) : offlineRepo.getSettings()),

  putSettings: (settings) => wrap('put', 'settings', 'app', async () =>
    currentMode === 'online' ? onlineRepo.putSettings(currentUid, settings) : offlineRepo.putSettings(settings)),

  // ---- Restore ----
  replaceAll: (data) => wrap('replace', 'all', null, async () =>
    currentMode === 'online' ? onlineRepo.replaceAll(currentUid, data) : offlineRepo.replaceAll(data)),

  mergeAll: (data, remapper) => wrap('merge', 'all', null, async () =>
    currentMode === 'online' ? onlineRepo.mergeAll(currentUid, data) : offlineRepo.mergeAll(data, remapper)),
}
