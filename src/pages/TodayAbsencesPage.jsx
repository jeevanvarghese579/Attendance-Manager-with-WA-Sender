// Today's Absentees — default panel.
// Shows circular roll-number buttons for the active class. Selections update
// draft state only. "Send to WhatsApp" saves the complete final list first,
// waits for confirmation, then opens WhatsApp.

import { useState, useMemo, useEffect } from 'react'
import { Send, CalendarDays, Loader2, RotateCcw } from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useToast } from '@/context/ToastContext'
import { useNav } from '@/context/NavContext'
import { todayKey, formatLongDate } from '@/utils/date'
import { sortByRollNumber } from '@/utils/sort'
import { buildAbsenteeMessage, whatsappUrl } from '@/utils/whatsapp'
import { savedAbsenteesForDate } from '@/utils/attendance'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import { Users, CalendarX } from 'lucide-react'

export default function TodayAbsencesPage() {
  const { activeClass, activeClassId, students, attendance, settings, setTodayAbsentees } = useData()
  const toast = useToast()
  const { setDirty } = useNav()
  const today = todayKey()

  const studentsInClass = useMemo(
    () => sortByRollNumber(students.filter(s => s.classId === activeClassId)),
    [students, activeClassId]
  )

  const savedSet = useMemo(
    () => savedAbsenteesForDate(attendance, activeClassId, today),
    [attendance, activeClassId, today]
  )

  const [draft, setDraft] = useState(() => new Set(savedSet))
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)

  // Resync draft when saved data or class changes.
  useEffect(() => { setDraft(new Set(savedSet)) }, [savedSet, activeClassId])

  const dirty = useMemo(() => !setsEqual(draft, savedSet), [draft, savedSet])
  useEffect(() => { setDirty(dirty) }, [dirty, setDirty])

  const toggle = (studentId) => {
    setDraft((prev) => {
      const next = new Set(prev)
      if (next.has(studentId)) next.delete(studentId)
      else next.add(studentId)
      return next
    })
  }

  const handleReset = () => setDraft(new Set(savedSet))

  const absentStudents = useMemo(
    () => studentsInClass.filter(s => draft.has(s.id)),
    [studentsInClass, draft]
  )

  const handleSend = async () => {
    if (saving) return // prevent concurrent saves
    if (!activeClassId) return
    setSaving(true)
    try {
      const ids = Array.from(draft)
      await setTodayAbsentees({ classId: activeClassId, studentIds: ids, date: today })
      setSavedAt(new Date())
      setDirty(false)
      toast.success('Absentees saved. Opening WhatsApp…')
      // Open WhatsApp only after save succeeds.
      const msg = buildAbsenteeMessage({ className: activeClass?.name, students: absentStudents, dateKey: today })
      window.open(whatsappUrl(msg), '_blank', 'noopener')
    } catch (e) {
      toast.error(`Could not save: ${e.message}. WhatsApp was not opened.`)
    } finally {
      setSaving(false)
    }
  }

  if (!activeClassId) {
    return <EmptyState icon={CalendarX} title="No active class" description="Create a class and set it active to mark today's absentees." />
  }
  if (studentsInClass.length === 0) {
    return <EmptyState icon={Users} title="No students in this class" description="Add students to this class to start marking attendance." />
  }

  return (
    <div className="space-y-5 pb-20">
      <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{formatLongDate(today)}</p>
          <h2 className="text-lg font-semibold">{activeClass?.name}</h2>
          <p className="mt-1 text-xs text-slate-400">
            Tap a roll number to mark absent. Changes are draft until you send to WhatsApp.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {dirty && (
            <Button variant="ghost" onClick={handleReset} disabled={saving}>
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
          )}
          <Button onClick={handleSend} loading={saving} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Send className="h-4 w-4" /> Send to WhatsApp</>}
          </Button>
        </div>
      </div>

      {/* Status line */}
      <div className="flex items-center gap-3 text-sm">
        <span className="chip bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
          {absentStudents.length} absent
        </span>
        <span className="chip bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          {studentsInClass.length - absentStudents.length} present
        </span>
        {savedAt && !dirty && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">Saved ✓</span>
        )}
        {dirty && (
          <span className="text-xs text-amber-600 dark:text-amber-400">Unsaved changes</span>
        )}
      </div>

      {/* Roll number grid */}
      <div className="card p-5">
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
          {studentsInClass.map((s) => {
            const selected = draft.has(s.id)
            return (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                aria-pressed={selected}
                aria-label={`${selected ? 'Absent' : 'Present'}: ${s.name}, roll ${s.rollNumber}`}
                title={`${s.name} (Roll ${s.rollNumber})`}
                className={[
                  'relative flex aspect-square flex-col items-center justify-center rounded-full border-2 text-sm font-semibold transition-all',
                  selected
                    ? 'border-rose-500 bg-rose-500 text-white shadow-md scale-105'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
                ].join(' ')}
              >
                <span>{s.rollNumber}</span>
                {selected && <span className="text-[9px] font-bold leading-none">Ab</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Legend + preview */}
      <div className="card p-5">
        <h3 className="mb-2 text-sm font-semibold">Preview</h3>
        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-2 border-slate-200 dark:border-slate-700" /> Present</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-2 border-rose-500 bg-rose-500" /> Absent (Ab)</span>
        </div>
        <pre className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800">
{buildAbsenteeMessage({ className: activeClass?.name, students: absentStudents, dateKey: today })}
        </pre>
      </div>

      {/* Persistent quick action while the attendance list scrolls. */}
      <Button
        onClick={handleSend}
        loading={saving}
        disabled={saving}
        aria-label="Save absentees and send to WhatsApp"
        className="fixed bottom-4 right-4 z-50 rounded-full px-4 py-3 shadow-lg shadow-slate-900/20 sm:bottom-6 sm:right-6 sm:px-5"
      >
        {saving
          ? 'Saving…'
          : <><Send className="h-4 w-4" /> <span className="hidden sm:inline">Send to WhatsApp</span><span className="sm:hidden">WhatsApp</span></>}
      </Button>
    </div>
  )
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}
