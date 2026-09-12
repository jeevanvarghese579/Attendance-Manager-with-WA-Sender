// IndexedDB repository — the offline persistence layer.
// Uses Dexie transactions for atomic batch writes (e.g. restore).

import { db, openDatabase } from './database'
import { uid } from '@/utils/ids'

async function ready() {
  await openDatabase()
}

export const offlineRepo = {
  async listClasses() {
    await ready()
    return db.classes.toArray()
  },

  async getClass(id) {
    await ready()
    return db.classes.get(id)
  },

  async putClass(c) {
    await ready()
    const rec = { ...c }
    if (!rec.id) rec.id = uid()
    await db.classes.put(rec)
    return rec
  },

  async deleteClass(id) {
    await ready()
    // Cascade: delete students and attendance for this class.
    await db.transaction('rw', db.classes, db.students, db.attendance, async () => {
      await db.classes.delete(id)
      const studentIds = (await db.students.where('classId').equals(id).toArray()).map(s => s.id)
      await db.students.where('classId').equals(id).delete()
      if (studentIds.length) await db.attendance.where('studentId').anyOf(studentIds).delete()
    })
  },

  async listStudents(classId) {
    await ready()
    if (classId) return db.students.where('classId').equals(classId).toArray()
    return db.students.toArray()
  },

  async putStudent(s) {
    await ready()
    const rec = { ...s }
    if (!rec.id) rec.id = uid()
    await db.students.put(rec)
    return rec
  },

  async bulkUpdateStudentRollNumbers({ classId, updates }) {
    await ready()
    await db.transaction('rw', db.students, async () => {
      const classStudents = await db.students.where('classId').equals(classId).toArray()
      const byId = new Map(classStudents.map(s => [s.id, s]))
      const nextRollById = new Map(updates.map(u => [u.studentId, String(u.rollNumber).trim()]))
      const seen = new Set()

      for (const student of classStudents) {
        const roll = nextRollById.get(student.id) ?? String(student.rollNumber).trim()
        if (!roll) throw new Error(`Roll number is required for ${student.name}.`)
        const key = roll.toLocaleLowerCase()
        if (seen.has(key)) throw new Error(`Duplicate roll number "${roll}".`)
        seen.add(key)
      }

      const records = updates.map(({ studentId, rollNumber }) => {
        const student = byId.get(studentId)
        if (!student) throw new Error('A student in this update no longer exists in the selected class.')
        return { ...student, rollNumber: String(rollNumber).trim() }
      })
      if (records.length) await db.students.bulkPut(records)
    })
  },

  async deleteStudent(id) {
    await ready()
    await db.transaction('rw', db.students, db.attendance, async () => {
      await db.students.delete(id)
      await db.attendance.where('studentId').equals(id).delete()
    })
  },

  async rollExists(classId, rollNumber, exceptId = null) {
    await ready()
    const found = await db.students.where('[classId+rollNumber]').equals([classId, rollNumber]).first()
    return !!found && found.id !== exceptId
  },

  async listAttendance() {
    await ready()
    return db.attendance.toArray()
  },

  async attendanceForStudent(studentId) {
    await ready()
    return db.attendance.where('studentId').equals(studentId).toArray()
  },

  async setStudentAttendance({ studentId, classId, dates }) {
    await ready()
    // Replace all attendance for this student with the given date set.
    await db.transaction('rw', db.attendance, async () => {
      await db.attendance.where('studentId').equals(studentId).delete()
      const rows = dates.map(date => ({
        id: uid(),
        studentId,
        classId,
        date,
      }))
      if (rows.length) await db.attendance.bulkPut(rows)
    })
  },

  async setTodayAbsentees({ classId, studentIds, date }) {
    await ready()
    // Replace attendance for this class on this date with the given student set.
    await db.transaction('rw', db.attendance, async () => {
      await db.attendance.where('classId').equals(classId).and(a => a.date === date).delete()
      const rows = studentIds.map(sid => ({ id: uid(), studentId: sid, classId, date }))
      if (rows.length) await db.attendance.bulkPut(rows)
    })
  },

  async listHolidays() {
    await ready()
    return db.holidays.toArray()
  },

  async setHolidays(dates) {
    await ready()
    await db.transaction('rw', db.holidays, async () => {
      await db.holidays.clear()
      const rows = dates.map(date => ({ id: uid(), date }))
      if (rows.length) await db.holidays.bulkPut(rows)
    })
  },

  async listOverrides() {
    await ready()
    return db.holidayOverrides.toArray()
  },

  async setOverrides(dates) {
    await ready()
    await db.transaction('rw', db.holidayOverrides, async () => {
      await db.holidayOverrides.clear()
      const rows = dates.map(date => ({ id: uid(), date }))
      if (rows.length) await db.holidayOverrides.bulkPut(rows)
    })
  },

  async getSettings() {
    await ready()
    const row = await db.settings.get('app')
    return row ? row.value : null
  },

  async putSettings(settings) {
    await ready()
    await db.settings.put({ id: 'app', value: settings })
  },

  async getProfile() {
    await ready()
    const row = await db.settings.get('profile')
    return row ? row.value : null
  },

  async putProfile(profile) {
    await ready()
    await db.settings.put({ id: 'profile', value: profile })
  },

  async replaceAll(data) {
    await ready()
    await db.transaction(
      'rw',
      db.classes, db.students, db.attendance, db.holidays, db.holidayOverrides, db.settings,
      async () => {
        await db.classes.clear()
        await db.students.clear()
        await db.attendance.clear()
        await db.holidays.clear()
        await db.holidayOverrides.clear()
        await db.settings.delete('app')
        if (data.classes?.length) await db.classes.bulkPut(data.classes)
        if (data.students?.length) await db.students.bulkPut(data.students)
        if (data.attendance?.length) await db.attendance.bulkPut(data.attendance)
        if (data.holidays?.length) await db.holidays.bulkPut(data.holidays)
        if (data.holidayOverrides?.length) await db.holidayOverrides.bulkPut(data.holidayOverrides)
        if (data.settings) await db.settings.put({ id: 'app', value: data.settings })
      }
    )
  },

  async mergeAll(data, remapper) {
    await ready()
    await db.transaction(
      'rw',
      db.classes, db.students, db.attendance, db.holidays, db.holidayOverrides, db.settings,
      async () => {
        if (data.classes?.length) await db.classes.bulkPut(data.classes)
        if (data.students?.length) await db.students.bulkPut(remapper.students)
        if (data.attendance?.length) await db.attendance.bulkPut(remapper.attendance)
        if (data.holidays?.length) await db.holidays.bulkPut(data.holidays)
        if (data.holidayOverrides?.length) await db.holidayOverrides.bulkPut(data.holidayOverrides)
        if (data.settings) await db.settings.put({ id: 'app', value: data.settings })
      }
    )
  },
}
