// Attendance calculations: working days, absences, cumulative stats.
// A date is never counted as both a holiday and an absence.

import { eachDayKeyOfMonth, eachMonthInRange, fromDateKey, toDateKey, compareDateKey } from '@/utils/date'

// Build the set of effective holiday date keys for a given settings + holidays + overrides.
// Effective logic:
//   If an explicit override exists for a date -> it is a WORKING DAY (override wins).
//   Otherwise if the date is a manual holiday -> holiday.
//   Otherwise if the global Saturday/Sunday setting applies -> holiday.
//   Otherwise -> working day.
// `overrides` is a list of { date } records: each marks that date as an
// explicit working day, overriding a global weekend holiday.
export function buildEffectiveHolidays({ academicStart, academicEnd, satHoliday, sunHoliday, holidays, overrides }) {
  const explicitHolidays = new Set(holidays.map(h => h.date))
  const overrideSet = new Set(overrides.map(o => o.date))
  const result = new Set()

  const months = academicStart && academicEnd
    ? eachMonthInRange(academicStart, academicEnd)
    : []

  for (const { year, month } of months) {
    for (const key of eachDayKeyOfMonth(year, month)) {
      if (overrideSet.has(key)) continue // explicit working day
      if (explicitHolidays.has(key)) { result.add(key); continue }
      const dow = fromDateKey(key).getDay()
      if (satHoliday && dow === 6) result.add(key)
      if (sunHoliday && dow === 0) result.add(key)
    }
  }
  return result
}

// Is a date an effective holiday?
export function isEffectiveHoliday(dateKey, effectiveHolidays) {
  return effectiveHolidays.has(dateKey)
}

// Rich per-date status for calendar rendering.
// Returns whether a date is an effective holiday, an override (working-day
// override of a global weekend holiday), a manually selected holiday, or a
// global weekend holiday.
export function dateStatus({ key, satHoliday, sunHoliday, holidays, overrides, effectiveHolidays }) {
  const overrideSet = new Set(overrides.map(o => o.date))
  const explicitHolidays = new Set(holidays.map(h => h.date))
  const dow = fromDateKey(key).getDay()
  const isOverride = overrideSet.has(key)
  const isManualHoliday = explicitHolidays.has(key)
  const isGlobalWeekendHoliday = (satHoliday && dow === 6) || (sunHoliday && dow === 0)
  const isEffectiveHoliday = effectiveHolidays.has(key)
  return { isOverride, isManualHoliday, isGlobalWeekendHoliday, isEffectiveHoliday }
}

// Effective absence: an absence that is NOT masked by a holiday.
export function isEffectiveAbsence(dateKey, absenceSet, effectiveHolidays) {
  return absenceSet.has(dateKey) && !effectiveHolidays.has(dateKey)
}

// Count working days in a range [start, end] (inclusive), excluding holidays.
export function workingDaysInRange(startKey, endKey, effectiveHolidays) {
  if (!startKey || !endKey) return 0
  const s = fromDateKey(startKey)
  const e = fromDateKey(endKey)
  let count = 0
  const d = new Date(s)
  while (d <= e) {
    const key = toDateKey(d)
    if (!effectiveHolidays.has(key)) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

// Per-month stats for one student.
// absences: Set of date keys for this student.
export function monthStats({ year, month, academicStart, academicEnd, attendanceStartDate, effectiveHolidays, absenceSet }) {
  const enrollmentStart = attendanceStartDate || academicStart
  const monthEnd = toDateKey(new Date(year, month + 1, 0))
  const notEnrolled = !!enrollmentStart && compareDateKey(monthEnd, enrollmentStart) < 0
  let workingDaysMonth = 0
  let absencesMonth = 0
  const absentDates = []

  for (const key of eachDayKeyOfMonth(year, month)) {
    if (academicStart && key < academicStart) continue
    if (academicEnd && key > academicEnd) continue
    if (enrollmentStart && key < enrollmentStart) continue
    if (effectiveHolidays.has(key)) continue
    workingDaysMonth++
    if (absenceSet.has(key)) {
      absencesMonth++
      absentDates.push(key)
    }
  }

  // Cumulative from academic-year start through end of this month.
  const cumEnd = academicEnd && compareDateKey(monthEnd, academicEnd) > 0 ? academicEnd : monthEnd
  const cumulativeStart = enrollmentStart || academicStart
  const cumWorkingDays = cumulativeStart && cumEnd && compareDateKey(cumulativeStart, cumEnd) <= 0
    ? workingDaysInRange(cumulativeStart, cumEnd, effectiveHolidays)
    : 0

  // Cumulative leaves from academic start through end of this month.
  let cumLeaves = 0
  if (cumulativeStart && cumEnd && compareDateKey(cumulativeStart, cumEnd) <= 0) {
    const months = eachMonthInRange(cumulativeStart, cumEnd)
    for (const m of months) {
      for (const key of eachDayKeyOfMonth(m.year, m.month)) {
        if (effectiveHolidays.has(key)) continue
        if (key < cumulativeStart) continue
        if (key > cumEnd) continue
        if (absenceSet.has(key)) cumLeaves++
      }
    }
  }

  const attendancePct = cumWorkingDays > 0
    ? Math.round(((cumWorkingDays - cumLeaves) / cumWorkingDays) * 10000) / 100
    : null
  const presentThisMonth = workingDaysMonth - absencesMonth
  const presentUpToThisMonth = cumWorkingDays - cumLeaves

  return {
    workingDaysMonth,
    absencesMonth,
    presentThisMonth,
    absentDates: absentDates.sort(compareDateKey),
    cumWorkingDays,
    cumLeaves,
    presentUpToThisMonth,
    attendancePct,
    notEnrolled,
  }
}

// For Today's Absentees: get the saved absent student IDs for a class+date.
export function savedAbsenteesForDate(attendance, classId, date) {
  return new Set(
    attendance.filter(a => a.classId === classId && a.date === date).map(a => a.studentId)
  )
}
