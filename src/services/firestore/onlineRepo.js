// Firestore repository — the online persistence layer.
// All data is scoped under users/{uid}/... and every write is awaited.
// We never trust a stored UID — it always comes from the authenticated user.
// Batches are used for atomic multi-record writes (replace/restore).

import {
  collection, doc, getDocs, setDoc, deleteDoc, writeBatch,
  query, where, onSnapshot,
} from 'firebase/firestore'
import { db } from '@/services/firebase/config'
import { uid as genId } from '@/utils/ids'
import { logError } from '@/utils/logger'

const ROOT = (uid) => `users/${uid}`

function colRef(uid, name) {
  return collection(db, `${ROOT(uid)}/${name}`)
}
function docRef(uid, name, id) {
  return doc(db, `${ROOT(uid)}/${name}`, id)
}

// Strip undefined fields (Firestore rejects them).
function clean(o) {
  const out = {}
  Object.keys(o).forEach(k => {
    if (o[k] !== undefined) out[k] = o[k]
  })
  return out
}

async function list(uid, name) {
  const snap = await getDocs(colRef(uid, name))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const onlineRepo = {
  async listClasses(uid) { return list(uid, 'classes') },

  async putClass(uid, c) {
    const rec = clean({ ...c })
    if (!rec.id) rec.id = genId()
    await setDoc(docRef(uid, 'classes', rec.id), rec, { merge: true })
    return rec
  },

  async deleteClass(uid, id) {
    // Cascade delete students + attendance under this class.
    const students = await getDocs(query(colRef(uid, 'students'), where('classId', '==', id)))
    const studentIds = students.docs.map(s => s.id)
    const batch = writeBatch(db)
    batch.delete(docRef(uid, 'classes', id))
    students.docs.forEach(s => batch.delete(docRef(uid, 'students', s.id)))
    if (studentIds.length) {
      const att = await getDocs(query(colRef(uid, 'attendance'), where('classId', '==', id)))
      att.docs.forEach(a => batch.delete(docRef(uid, 'attendance', a.id)))
    }
    await batch.commit()
  },

  async listStudents(uid, classId) {
    if (!classId) return list(uid, 'students')
    const snap = await getDocs(query(colRef(uid, 'students'), where('classId', '==', classId)))
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },

  async putStudent(uid, s) {
    const rec = clean({ ...s })
    if (!rec.id) rec.id = genId()
    await setDoc(docRef(uid, 'students', rec.id), rec, { merge: true })
    return rec
  },

  async bulkUpdateStudentRollNumbers(uid, { classId, updates }) {
    const snapshot = await getDocs(query(colRef(uid, 'students'), where('classId', '==', classId)))
    const byId = new Map(snapshot.docs.map(d => [d.id, { id: d.id, ...d.data() }]))
    const nextRollById = new Map(updates.map(u => [u.studentId, String(u.rollNumber).trim()]))
    const seen = new Set()

    for (const student of byId.values()) {
      const roll = nextRollById.get(student.id) ?? String(student.rollNumber).trim()
      if (!roll) throw new Error(`Roll number is required for ${student.name}.`)
      const key = roll.toLocaleLowerCase()
      if (seen.has(key)) throw new Error(`Duplicate roll number "${roll}".`)
      seen.add(key)
    }

    const batch = writeBatch(db)
    updates.forEach(({ studentId, rollNumber }) => {
      if (!byId.has(studentId)) throw new Error('A student in this update no longer exists in the selected class.')
      batch.set(docRef(uid, 'students', studentId), { rollNumber: String(rollNumber).trim() }, { merge: true })
    })
    await batch.commit()
  },

  async deleteStudent(uid, id) {
    const batch = writeBatch(db)
    batch.delete(docRef(uid, 'students', id))
    const att = await getDocs(query(colRef(uid, 'attendance'), where('studentId', '==', id)))
    att.docs.forEach(a => batch.delete(docRef(uid, 'attendance', a.id)))
    await batch.commit()
  },

  async rollExists(uid, classId, rollNumber, exceptId = null) {
    const snap = await getDocs(query(
      colRef(uid, 'students'),
      where('classId', '==', classId),
      where('rollNumber', '==', rollNumber)
    ))
    const found = snap.docs.find(d => d.id !== exceptId)
    return !!found
  },

  async listAttendance(uid) { return list(uid, 'attendance') },

  async attendanceForStudent(uid, studentId) {
    const snap = await getDocs(query(colRef(uid, 'attendance'), where('studentId', '==', studentId)))
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },

  async setStudentAttendance({ uid, studentId, classId, dates }) {
    // Delete existing attendance for student, then write new set, in a batch.
    const existing = await getDocs(query(colRef(uid, 'attendance'), where('studentId', '==', studentId)))
    const batch = writeBatch(db)
    existing.docs.forEach(d => batch.delete(docRef(uid, 'attendance', d.id)))
    dates.forEach(date => {
      const id = genId()
      batch.set(docRef(uid, 'attendance', id), { id, studentId, classId, date })
    })
    await batch.commit()
  },

  async setTodayAbsentees({ uid, classId, studentIds, date }) {
    // Replace attendance for this class on this date.
    const existing = await getDocs(query(colRef(uid, 'attendance'), where('classId', '==', classId)))
    const batch = writeBatch(db)
    existing.docs.forEach(d => {
      const data = d.data()
      if (data.date === date) batch.delete(docRef(uid, 'attendance', d.id))
    })
    studentIds.forEach(sid => {
      const id = genId()
      batch.set(docRef(uid, 'attendance', id), { id, studentId: sid, classId, date })
    })
    await batch.commit()
  },

  async listHolidays(uid) { return list(uid, 'holidays') },

  async setHolidays(uid, dates) {
    const existing = await getDocs(colRef(uid, 'holidays'))
    const batch = writeBatch(db)
    existing.docs.forEach(d => batch.delete(docRef(uid, 'holidays', d.id)))
    dates.forEach(date => {
      const id = genId()
      batch.set(docRef(uid, 'holidays', id), { id, date })
    })
    await batch.commit()
  },

  async listOverrides(uid) { return list(uid, 'holidayOverrides') },

  async setOverrides(uid, dates) {
    const existing = await getDocs(colRef(uid, 'holidayOverrides'))
    const batch = writeBatch(db)
    existing.docs.forEach(d => batch.delete(docRef(uid, 'holidayOverrides', d.id)))
    dates.forEach(date => {
      const id = genId()
      batch.set(docRef(uid, 'holidayOverrides', id), { id, date })
    })
    await batch.commit()
  },

  async getSettings(uid) {
    const snap = await getDocs(colRef(uid, 'settings'))
    const row = snap.docs.find(d => d.id === 'app')
    return row ? row.data().value : null
  },

  async putSettings(uid, settings) {
    await setDoc(docRef(uid, 'settings', 'app'), { value: settings }, { merge: true })
  },

  async replaceAll(uid, data) {
    // Atomic-ish full replacement using batches (Firestore batches max 500 ops).
    const collections = ['classes', 'students', 'attendance', 'holidays', 'holidayOverrides']
    const batch = writeBatch(db)
    for (const name of collections) {
      const existing = await getDocs(colRef(uid, name))
      existing.docs.forEach(d => batch.delete(docRef(uid, name, d.id)))
    }
    for (const c of data.classes || []) batch.set(docRef(uid, 'classes', c.id), clean(c))
    for (const s of data.students || []) batch.set(docRef(uid, 'students', s.id), clean(s))
    for (const a of data.attendance || []) batch.set(docRef(uid, 'attendance', a.id), clean(a))
    for (const h of data.holidays || []) batch.set(docRef(uid, 'holidays', h.id), clean(h))
    for (const o of data.holidayOverrides || []) batch.set(docRef(uid, 'holidayOverrides', o.id), clean(o))
    if (data.settings) batch.set(docRef(uid, 'settings', 'app'), { value: data.settings })
    await batch.commit()
  },

  async mergeAll(uid, data) {
    const batch = writeBatch(db)
    for (const c of data.classes || []) batch.set(docRef(uid, 'classes', c.id), clean(c), { merge: true })
    for (const s of data.students || []) batch.set(docRef(uid, 'students', s.id), clean(s), { merge: true })
    for (const a of data.attendance || []) batch.set(docRef(uid, 'attendance', a.id), clean(a), { merge: true })
    for (const h of data.holidays || []) batch.set(docRef(uid, 'holidays', h.id), clean(h), { merge: true })
    for (const o of data.holidayOverrides || []) batch.set(docRef(uid, 'holidayOverrides', o.id), clean(o), { merge: true })
    if (data.settings) batch.set(docRef(uid, 'settings', 'app'), { value: data.settings }, { merge: true })
    await batch.commit()
  },
}

// Wrap an async repo op with structured error logging.
export async function withLogging(uid, operation, collection, recordId, fn) {
  try {
    return await fn()
  } catch (error) {
    logError({ uid, operation, collection, recordId, error })
    throw error
  }
}
