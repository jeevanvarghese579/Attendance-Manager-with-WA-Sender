// Holiday Manager — month grid, calendar with draft holidays + weekend overrides.
// Global Saturday/Sunday settings drive default holidays; individual weekend
// dates can be overridden as working days. Explicit overrides stored separately.

import { useState, useMemo, useEffect } from 'react'
import { CalendarDays, Save, RotateCcw, Loader2 } from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useToast } from '@/context/ToastContext'
import { useNav } from '@/context/NavContext'
import {
  eachMonthInRange, eachDayKeyOfMonth, fromDateKey, toDateKey, monthLabel,
} from '@/utils/date'
import { buildEffectiveHolidays, dateStatus } from '@/utils/attendance'
import Calendar from '@/components/ui/Calendar'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'

export default function HolidayManagerPage() {
  const { settings, holidays, overrides, saveHolidays, saveOverrides } = useData()
  const toast = useToast()
  const { setDirty } = useNav()

  const satHoliday = settings?.satHoliday ?? false
  const sunHoliday = settings?.sunHoliday ?? true
  const academicStart = settings?.academicStart || ''
  const academicEnd = settings?.academicEnd || ''

  const savedHolidaySet = useMemo(() => new Set(holidays.map(h => h.date)), [holidays])
  const savedOverrideSet = useMemo(() => new Set(overrides.map(o => o.date)), [overrides])

  const [draftHolidays, setDraftHolidays] = useState(savedHolidaySet)
  const [draftOverrides, setDraftOverrides] = useState(savedOverrideSet)
  const [openMonth, setOpenMonth] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setDraftHolidays(savedHolidaySet) }, [savedHolidaySet])
  useEffect(() => { setDraftOverrides(savedOverrideSet) }, [savedOverrideSet])

  const dirty = !setsEqual(draftHolidays, savedHolidaySet) || !setsEqual(draftOverrides, savedOverrideSet)
  useEffect(() => { setDirty(dirty) }, [dirty, setDirty])

  const months = useMemo(() => eachMonthInRange(academicStart, academicEnd), [academicStart, academicEnd])

  const draftHolidaysList = useMemo(() => Array.from(draftHolidays).map(d => ({ date: d })), [draftHolidays])
  const draftOverridesList = useMemo(() => Array.from(draftOverrides).map(d => ({ date: d })), [draftOverrides])

  const effectiveHolidays = useMemo(
    () => buildEffectiveHolidays({ academicStart, academicEnd, satHoliday, sunHoliday, holidays: draftHolidaysList, overrides: draftOverridesList }),
    [academicStart, academicEnd, satHoliday, sunHoliday, draftHolidaysList, draftOverridesList]
  )

  const toggleDate = (key) => {
    const dow = fromDateKey(key).getDay()
    const isWeekend = (satHoliday && dow === 6) || (sunHoliday && dow === 0)
    if (isWeekend) {
      if (draftOverrides.has(key)) {
        setDraftOverrides((prev) => withoutDate(prev, key))
      } else if (draftHolidays.has(key)) {
        setDraftHolidays((prev) => withoutDate(prev, key))
      } else {
        setDraftOverrides((prev) => withDate(prev, key))
      }
      return
    }

    setDraftHolidays((prev) => prev.has(key) ? withoutDate(prev, key) : withDate(prev, key))
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      await Promise.all([
        saveHolidays(Array.from(draftHolidays)),
        saveOverrides(Array.from(draftOverrides)),
      ])
      toast.success('Holidays saved.')
      setDirty(false)
    } catch (e) {
      toast.error(`Could not save: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setDraftHolidays(savedHolidaySet)
    setDraftOverrides(savedOverrideSet)
  }

  if (!academicStart || !academicEnd) {
    return <EmptyState icon={CalendarDays} title="Set the academic year first" description="Go to Settings and choose an academic-year start and end date to manage holidays." />
  }
  if (months.length === 0) {
    return <EmptyState icon={CalendarDays} title="No months in range" description="Check your academic-year dates in Settings." />
  }

  return (
    <div className="space-y-5">
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Academic Year</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {toDateKey(fromDateKey(academicStart))} → {toDateKey(fromDateKey(academicEnd))} · {months.length} months
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {dirty && <Button variant="ghost" onClick={handleReset} disabled={saving}><RotateCcw className="h-4 w-4" /> Reset</Button>}
          <Button onClick={handleSave} loading={saving} disabled={!dirty}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> Save Holidays</>}
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-300" /> Holiday</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20" /> Working day (override)</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800" /> Working day</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded ring-2 ring-brand-500" /> Today</span>
      </div>

      {/* Month grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {months.map(({ year, month }) => {
          const key = `${year}-${month}`
          const isHolidayCount = Array.from(eachDayKeyOfMonth(year, month)).filter(k => effectiveHolidays.has(k)).length
          return (
            <button
              key={key}
              onClick={() => setOpenMonth({ year, month })}
              className="card p-4 text-left transition hover:ring-2 hover:ring-brand-500"
            >
              <p className="font-semibold">{monthLabel(year, month)}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{isHolidayCount} holiday{isHolidayCount !== 1 ? 's' : ''}</p>
            </button>
          )
        })}
      </div>

      {/* Month calendar modal */}
      {openMonth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setOpenMonth(null)} />
          <div className="relative w-full max-w-md card animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <h2 className="text-lg font-semibold">{monthLabel(openMonth.year, openMonth.month)}</h2>
              <Button variant="ghost" size="sm" onClick={() => setOpenMonth(null)}>Close</Button>
            </div>
            <div className="p-5">
              <Calendar
                year={openMonth.year}
                month={openMonth.month}
                renderDay={(dateKey) => {
                  const st = dateStatus({ key: dateKey, satHoliday, sunHoliday, holidays: draftHolidaysList, overrides: draftOverridesList, effectiveHolidays })
                  const dow = fromDateKey(dateKey).getDay()
                  const isWeekend = dow === 0 || dow === 6
                  let className = 'border-slate-200 bg-white hover:border-brand-400 dark:border-slate-700 dark:bg-slate-800'
                  let badge = ''
                  if (st.isOverride) {
                    className = 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200'
                    badge = 'W'
                  } else if (st.isEffectiveHoliday) {
                    className = 'border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-200'
                    badge = 'H'
                  }
                  return {
                    className,
                    badge,
                    ariaLabel: `${dateKey}${st.isEffectiveHoliday ? ' (holiday)' : ''}${st.isOverride ? ' (working day override)' : ''}`,
                    title: st.isOverride ? 'Overridden as working day — click to restore weekend holiday' : isWeekend ? 'Weekend — click to override as working day' : 'Working day — click to mark holiday',
                  }
                }}
                onToggleDate={toggleDate}
              />
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Click a weekend date to override it as a working day. Click a weekday to mark it as a holiday.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}

function withDate(source, key) {
  const next = new Set(source)
  next.add(key)
  return next
}

function withoutDate(source, key) {
  const next = new Set(source)
  next.delete(key)
  return next
}
