// Data context — the central store for all app data.
// Loads everything for the active profile (online uid or offline) and exposes
// immutable updates, save operations, and an active-class selector.
// Default class is a device-local preference (never synced, never in backups).

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { repo } from '@/repositories/repo'
import { getPref, setPref, PREF_DEFAULT_CLASS } from '@/services/indexeddb/database'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const { mode, user } = useAuth()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [attendance, setAttendance] = useState([])
  const [holidays, setHolidays] = useState([])
  const [overrides, setOverrides] = useState([])
  const [settings, setSettings] = useState(null)
  const [activeClassId, setActiveClassId] = useState(null)
  const [defaultClassId, setDefaultClassId] = useState(null)
  const loadTokenRef = useRef(0)

  const active = mode === 'online' && user ? user.uid : 'offline'

  // Load all data for the active profile. Uses a token to discard stale loads.
  const loadAll = useCallback(async () => {
    const token = ++loadTokenRef.current
    setLoading(true)
    try {
      const [cls, studs, att, hols, ovr, stg, defClass] = await Promise.all([
        repo.listClasses(),
        repo.listStudents(),
        repo.listAttendance(),
        repo.listHolidays(),
        repo.listOverrides(),
        repo.getSettings(),
        getPref(PREF_DEFAULT_CLASS, null),
      ])
      if (token !== loadTokenRef.current) return // stale
      setClasses(cls)
      setStudents(studs)
      setAttendance(att)
      setHolidays(hols)
      setOverrides(ovr)
      setSettings(stg || defaultSettings())
      setDefaultClassId(defClass)
      // Resolve active class: default > first class > null
      let chosen = defClass && cls.some(c => c.id === defClass) ? defClass : null
      if (!chosen && cls.length) chosen = cls[0].id
      setActiveClassId(chosen)
    } catch (e) {
      if (token !== loadTokenRef.current) return
      toast.error(`Could not load your data: ${e.message}`)
    } finally {
      if (token === loadTokenRef.current) setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (mode === 'online' || mode === 'offline') {
      loadAll()
    }
  }, [mode, user, loadAll])

  // ---- Settings helpers ----
  const defaultSettings = () => ({
    academicStart: '',
    academicEnd: '',
    satHoliday: false,
    sunHoliday: true,
  })

  const saveSettings = useCallback(async (next) => {
    await repo.putSettings(next)
    setSettings(next)
  }, [])

  // ---- Default class (device-local only) ----
  const setDefaultClass = useCallback(async (id) => {
    setDefaultClassId(id)
    await setPref(PREF_DEFAULT_CLASS, id)
  }, [])

  // ---- Classes ----
  const createClass = useCallback(async (name) => {
    const rec = await repo.putClass({ id: undefined, name: name.trim() })
    setClasses((c) => [...c, rec])
    if (!activeClassId) setActiveClassId(rec.id)
    return rec
  }, [activeClassId])

  const renameClass = useCallback(async (id, name) => {
    const existing = classes.find(c => c.id === id)
    if (!existing) return
    const rec = { ...existing, name: name.trim() }
    await repo.putClass(rec)
    setClasses((c) => c.map(x => x.id === id ? rec : x))
  }, [classes])

  const deleteClass = useCallback(async (id) => {
    await repo.deleteClass(id)
    setClasses((c) => c.filter(x => x.id !== id))
    setStudents((s) => s.filter(x => x.classId !== id))
    setAttendance((a) => a.filter(x => x.classId !== id))
    if (defaultClassId === id) { setDefaultClassId(null); setPref(PREF_DEFAULT_CLASS, null).catch(() => {}) }
    if (activeClassId === id) {
      const remaining = classes.filter(c => c.id !== id)
      setActiveClassId(remaining.length ? remaining[0].id : null)
    }
  }, [classes, defaultClassId, activeClassId])

  const selectClass = useCallback((id) => setActiveClassId(id), [])

  // ---- Students ----
  const studentsInClass = useCallback((classId) =>
    students.filter(s => s.classId === classId), [students])

  const rollExists = useCallback((classId, rollNumber, exceptId = null) =>
    repo.rollExists(classId, rollNumber, exceptId), [])

  const addStudent = useCallback(async ({ classId, rollNumber, name }) => {
    const rec = await repo.putStudent({ id: undefined, classId, rollNumber: rollNumber.trim(), name: name.trim() })
    setStudents((s) => [...s, rec])
    return rec
  }, [])

  const updateStudent = useCallback(async (student) => {
    const rec = {
      ...student,
      rollNumber: student.rollNumber.trim(),
      name: student.name.trim(),
      attendanceStartDate: student.attendanceStartDate || undefined,
    }
    await repo.putStudent(rec)
    setStudents((s) => s.map(x => x.id === rec.id ? rec : x))
  }, [])

  const bulkUpdateStudentRollNumbers = useCallback(async ({ classId, updates }) => {
    await repo.bulkUpdateStudentRollNumbers({ classId, updates })
    const nextRollById = new Map(updates.map(u => [u.studentId, u.rollNumber.trim()]))
    setStudents((current) => current.map(student => (
      student.classId === classId && nextRollById.has(student.id)
        ? { ...student, rollNumber: nextRollById.get(student.id) }
        : student
    )))
  }, [])

  const moveStudent = useCallback(async (studentId, newClassId) => {
    const s = students.find(x => x.id === studentId)
    if (!s) return
    const rec = { ...s, classId: newClassId }
    await repo.putStudent(rec)
    setStudents((arr) => arr.map(x => x.id === studentId ? rec : x))
  }, [students])

  const deleteStudent = useCallback(async (id) => {
    await repo.deleteStudent(id)
    setStudents((s) => s.filter(x => x.id !== id))
    setAttendance((a) => a.filter(x => x.studentId !== id))
  }, [])

  const bulkAddStudents = useCallback(async (classId, rows) => {
    const recs = []
    for (const r of rows) {
      const rec = await repo.putStudent({ id: undefined, classId, rollNumber: r.rollNumber, name: r.name })
      recs.push(rec)
    }
    setStudents((s) => [...s, ...recs])
    return recs
  }, [])

  // ---- Attendance ----
  const setStudentAttendance = useCallback(async ({ studentId, classId, dates }) => {
    await repo.setStudentAttendance({ studentId, classId, dates })
    // Reload attendance to reflect the single source of truth.
    const att = await repo.listAttendance()
    setAttendance(att)
  }, [])

  const setTodayAbsentees = useCallback(async ({ classId, studentIds, date }) => {
    await repo.setTodayAbsentees({ classId, studentIds, date })
    const att = await repo.listAttendance()
    setAttendance(att)
  }, [])

  // ---- Holidays ----
  const saveHolidays = useCallback(async (dates) => {
    await repo.setHolidays(dates)
    setHolidays(dates.map(d => ({ id: d, date: d })))
  }, [])

  const saveOverrides = useCallback(async (dates) => {
    await repo.setOverrides(dates)
    setOverrides(dates.map(d => ({ id: d, date: d })))
  }, [])

  // ---- Restore ----
  const reloadAfterRestore = useCallback(async () => {
    await loadAll()
  }, [loadAll])

  const value = {
    loading, classes, students, attendance, holidays, overrides, settings,
    activeClassId, defaultClassId,
    activeClass: classes.find(c => c.id === activeClassId) || null,
    setActiveClassId: selectClass, setDefaultClass,
    saveSettings,
    createClass, renameClass, deleteClass,
    studentsInClass, rollExists, addStudent, updateStudent, bulkUpdateStudentRollNumbers, moveStudent, deleteStudent, bulkAddStudents,
    setStudentAttendance, setTodayAbsentees,
    saveHolidays, saveOverrides,
    reloadAll: loadAll, reloadAfterRestore,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
