// Attendance Report — per-student month calendar with draft absences,
// Save Attendance button, and cumulative statistics. Plus a button to generate
// the full-class PDF.

import { useState, useMemo, useEffect } from 'react'
import { Save, Loader2, RotateCcw, FileText, ClipboardList } from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useToast } from '@/context/ToastContext'
import { useNav } from '@/context/NavContext'
import {
  eachMonthInRange, fromDateKey, toDateKey, monthLabel, monthKeyFromYM, formatShortDate,
} from '@/utils/date'
import { buildEffectiveHolidays, monthStats, dateStatus } from '@/utils/attendance'
import { sortByRollNumber } from '@/utils/sort'
import { generateClassPdf } from '@/services/pdf/classReport'
import Calendar from '@/components/ui/Calendar'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import Input from '@/components/ui/Input'
import EmptyState from '@/components/ui/EmptyState'
import { Users } from 'lucide-react'

export default function AttendanceReportPage() {
  const {
    classes, activeClassId, students, attendance, settings, holidays, overrides,
    setStudentAttendance, updateStudent,
  } = useData()
  const toast = useToast()
  const { setDirty } = useNav()

  const [classId, setClassId] = useState(activeClassId || '')
  useEffect(() => { setClassId(activeClassId || '') }, [activeClassId])

  const classStudents = useMemo(
    () => sortByRollNumber(students.filter(s => s.classId === classId)),
    [students, classId]
  )
  const [studentId, setStudentId] = useState('')
  useEffect(() => { setStudentId(classStudents[0]?.id || '') }, [classStudents])

  const satHoliday = settings?.satHoliday ?? false
  const sunHoliday = settings?.sunHoliday ?? true
  const academicStart = settings?.academicStart || ''
  const academicEnd = settings?.academicEnd || ''
  const student = classStudents.find(s => s.id === studentId)
  const attendanceStartDate = student?.attendanceStartDate || academicStart

  const months = useMemo(() => eachMonthInRange(academicStart, academicEnd), [academicStart, academicEnd])
  const [selectedMonth, setSelectedMonth] = useState('') // 'YYYY-M'

  useEffect(() => {
    if (!months.length) return
    const selected = months.find(({ year, month }) => monthKeyFromYM(year, month) === selectedMonth)
    if (selected && !monthIsBeforeStart(selected.year, selected.month, attendanceStartDate)) return
    const firstEnrolledMonth = months.find(({ year, month }) => !monthIsBeforeStart(year, month, attendanceStartDate))
    setSelectedMonth(firstEnrolledMonth ? monthKeyFromYM(firstEnrolledMonth.year, firstEnrolledMonth.month) : '')
  }, [months, selectedMonth, attendanceStartDate])

  // Saved absences for this student (date keys).
  const savedAbsences = useMemo(() => {
    if (!studentId) return new Set()
    return new Set(attendance.filter(a => a.studentId === studentId).map(a => a.date))
  }, [attendance, studentId])

  const [draft, setDraft] = useState(savedAbsences)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)

  useEffect(() => { setDraft(savedAbsences) }, [savedAbsences, studentId, selectedMonth])

  const dirty = useMemo(() => !setsEqual(draft, savedAbsences), [draft, savedAbsences])
  useEffect(() => { setDirty(dirty) }, [dirty, setDirty])

  const holidaysList = useMemo(() => holidays.map(h => ({ date: h.date })), [holidays])
  const overridesList = useMemo(() => overrides.map(o => ({ date: o.date })), [overrides])

  const effectiveHolidays = useMemo(
    () => buildEffectiveHolidays({ academicStart, academicEnd, satHoliday, sunHoliday, holidays: holidaysList, overrides: overridesList }),
    [academicStart, academicEnd, satHoliday, sunHoliday, holidaysList, overridesList]
  )

  // Month parse
  const [sy, sm] = selectedMonth ? selectedMonth.split('-').map(Number) : [null, null]
  const selYear = sy ? sy : null
  const selMonth = sm != null ? sm - 1 : null

  const stats = useMemo(() => {
    if (selYear == null || selMonth == null || !studentId) return null
    return monthStats({ year: selYear, month: selMonth, academicStart, academicEnd, attendanceStartDate, effectiveHolidays, absenceSet: draft })
  }, [selYear, selMonth, academicStart, academicEnd, attendanceStartDate, effectiveHolidays, draft, studentId])

  const toggleDate = (key) => {
    // Don't allow marking a holiday as absent (it's excluded anyway).
    if (effectiveHolidays.has(key) || (attendanceStartDate && key < attendanceStartDate)) return
    setDraft((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleSave = async () => {
    if (saving || !studentId || !classId) return
    setSaving(true)
    try {
      await setStudentAttendance({ studentId, classId, dates: Array.from(draft) })
      setSavedAt(new Date())
      setDirty(false)
      toast.success('Attendance saved.')
    } catch (e) {
      toast.error(`Could not save: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => setDraft(savedAbsences)

  const handleAttendanceStartChange = async (event) => {
    const nextDate = event.target.value
    if (!student || !nextDate || nextDate === attendanceStartDate) return
    if ((academicStart && nextDate < academicStart) || (academicEnd && nextDate > academicEnd)) {
      toast.error('Attendance start date must be within the academic year.')
      return
    }
    const confirmed = window.confirm(
      `Change ${student.name}'s attendance start date to ${formatShortDate(nextDate)}? Dates before this will be treated as Not Enrolled and excluded from reports.`
    )
    if (!confirmed) return
    try {
      await updateStudent({ ...student, attendanceStartDate: nextDate })
      setSavedAt(null)
      toast.success('Attendance start date updated.')
    } catch (e) {
      toast.error(`Could not update attendance start date: ${e.message}`)
    }
  }

  const handlePdf = () => {
    if (!classId) return
    // Map absence keys onto each student for the PDF generator.
    const enriched = classStudents.map(s => ({
      ...s,
      _absenceKeys: attendance.filter(a => a.studentId === s.id).map(a => a.date),
    }))
    const className = classes.find(c => c.id === classId)?.name || ''
    const academicYear = academicStart && academicEnd ? `${toDateKey(fromDateKey(academicStart))} – ${toDateKey(fromDateKey(academicEnd))}` : ''
    try {
      generateClassPdf({ className, academicYear, students: enriched, effectiveHolidays, academicStart, academicEnd })
      toast.success('PDF generated.')
    } catch (e) {
      toast.error(`Could not generate PDF: ${e.message}`)
    }
  }

  if (!classId) {
    return <EmptyState icon={ClipboardList} title="Select a class" description="Choose a class to view attendance reports." />
  }
  if (classStudents.length === 0) {
    return <EmptyState icon={Users} title="No students" description="Add students to this class first." />
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Class" id="reportClass" value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select label="Student" id="reportStudent" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            {classStudents.map(s => <option key={s.id} value={s.id}>{s.rollNumber} — {s.name}</option>)}
          </Select>
          <Input
            label="Attendance Start Date"
            id="attendanceStartDate"
            type="date"
            min={academicStart || undefined}
            max={academicEnd || undefined}
            value={attendanceStartDate}
            onChange={handleAttendanceStartChange}
          />
          <Select label="Month" id="reportMonth" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
            {months.map(({ year, month }) => (
              <option
                key={`${year}-${month}`}
                value={monthKeyFromYM(year, month)}
                disabled={monthIsBeforeStart(year, month, attendanceStartDate)}
              >
                {monthLabel(year, month)}{monthIsBeforeStart(year, month, attendanceStartDate) ? ' — Not Enrolled' : ''}
              </option>
            ))}
          </Select>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Yellow dates are holidays (not counted). Red dates are absences.
          </p>
          <Button variant="secondary" size="sm" onClick={handlePdf}>
            <FileText className="h-4 w-4" /> Generate class PDF
          </Button>
        </div>
      </div>

      {student && selYear != null && (
        <>
          <div className="card p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">{student.name} <span className="text-slate-400">· Roll {student.rollNumber}</span></h3>
              {attendanceStartDate && (
                <span className="chip bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                  Joined: {formatShortDate(attendanceStartDate)}
                </span>
              )}
              <div className="flex gap-2">
                {dirty && <Button variant="ghost" size="sm" onClick={handleReset} disabled={saving}><RotateCcw className="h-4 w-4" /> Reset</Button>}
                <Button size="sm" onClick={handleSave} loading={saving} disabled={!dirty}>
                  {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> Save Attendance</>}
                </Button>
              </div>
            </div>

            <Calendar
              year={selYear}
              month={selMonth}
              renderDay={(dateKey) => {
                const isNotEnrolled = attendanceStartDate && dateKey < attendanceStartDate
                const isHoliday = effectiveHolidays.has(dateKey)
                const isAbsent = draft.has(dateKey)
                const dow = fromDateKey(dateKey).getDay()
                const st = dateStatus({ key: dateKey, satHoliday, sunHoliday, holidays: holidaysList, overrides: overridesList, effectiveHolidays })
                let className = 'border-slate-200 bg-white hover:border-brand-400 dark:border-slate-700 dark:bg-slate-800'
                let badge = ''
                if (isNotEnrolled) {
                  return {
                    className: 'border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500',
                    badge: 'Not Enrolled',
                    badgeClassName: 'absolute bottom-1 left-0 right-0 text-center text-[6px] font-bold leading-none',
                    disabled: true,
                    title: 'Not Enrolled',
                    ariaLabel: `${dateKey} (Not Enrolled)`,
                  }
                }
                if (isHoliday) {
                  className = 'border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-200'
                  badge = 'H'
                }
                if (st.isOverride) { className = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'; badge = 'W' }
                // Absence styling overrides holiday working-day but NOT yellow holiday.
                if (isAbsent && !isHoliday) {
                  className = 'border-rose-500 bg-rose-500 text-white'
                  badge = 'Ab'
                }
                if (isHoliday) {
                  return { className, badge, disabled: true, title: 'Holiday — not counted', ariaLabel: `${dateKey} (holiday)` }
                }
                return { className, badge, title: isAbsent ? 'Absent — click to clear' : 'Present — click to mark absent', ariaLabel: `${dateKey}${isAbsent ? ' (absent)' : ''}` }
              }}
              onToggleDate={toggleDate}
            />

            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-rose-500 bg-rose-500" /> Absent</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-amber-400 bg-amber-100" /> Holiday</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-emerald-500 bg-emerald-50" /> Working day override</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-slate-200 dark:border-slate-700" /> Working day</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900" /> Not Enrolled</span>
            </div>

            {dirty && <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">You have unsaved changes.</p>}
            {savedAt && !dirty && <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400">Saved ✓</p>}
          </div>

          {/* Summary */}
          {stats && (
            <div className="card p-5">
              <h3 className="mb-3 font-semibold">Summary — {monthLabel(selYear, selMonth)}</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <StatLinesCard lines={[
                  `Present This Month: ${stats.presentThisMonth}`,
                  `Working Days This Month: ${stats.workingDaysMonth}`,
                ]} />
                <StatCard label="Absences (Month)" value={stats.absencesMonth} />
                <StatLinesCard lines={[
                  `Present Up to This Month: ${stats.presentUpToThisMonth}`,
                  `Working Days Up to This Month: ${stats.cumWorkingDays}`,
                ]} />
                <StatCard label="Cumulative Total Leaves" value={stats.cumLeaves} />
                <StatCard label="Attendance %" value={stats.attendancePct === null ? 'N/A' : `${stats.attendancePct}%`} highlight />
              </div>
              {stats.absentDates.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Absent dates this month:</p>
                  <p className="mt-1 text-sm">{stats.absentDates.map(k => String(fromDateKey(k).getDate())).join(', ')}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, hint, highlight }) {
  return (
    <div className={`rounded-xl border p-3 ${highlight ? 'border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-900/20' : 'border-slate-200 dark:border-slate-800'}`}>
      <p className={`text-2xl font-bold ${highlight ? 'text-brand-700 dark:text-brand-300' : ''}`}>{value}</p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{label}</p>
      {hint && <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  )
}

function StatLinesCard({ lines }) {
  return (
    <div className="flex flex-col justify-center gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
      {lines.map(line => <p key={line} className="text-sm font-semibold">{line}</p>)}
    </div>
  )
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}

function monthIsBeforeStart(year, month, startDate) {
  if (!startDate) return false
  return toDateKey(new Date(year, month + 1, 0)) < startDate
}
