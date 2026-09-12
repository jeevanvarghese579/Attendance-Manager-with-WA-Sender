// Settings — academic year, weekend behavior, theme, backup/restore, about.

import { useState, useRef } from 'react'
import {
  CalendarRange, Sun, Moon, Database, Download, Upload, Info, Loader2, Check,
} from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useToast } from '@/context/ToastContext'
import {
  createMasterBackup, readBackupFile, restoreReplace, restoreMerge,
} from '@/services/backup/backup'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Input, { Field } from '@/components/ui/Input'
import { toDateKey } from '@/utils/date'

export default function SettingsPage() {
  const { settings, saveSettings, reloadAfterRestore } = useData()
  const { mode, user } = useAuth()
  const { theme, setTheme } = useTheme()
  const toast = useToast()

  const [start, setStart] = useState(settings?.academicStart || '')
  const [end, setEnd] = useState(settings?.academicEnd || '')
  const [sat, setSat] = useState(settings?.satHoliday ?? false)
  const [sun, setSun] = useState(settings?.sunHoliday ?? true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [backupOpen, setBackupOpen] = useState(false)
  const [restoreOpen, setRestoreOpen] = useState(null) // null | { backup, summary }
  const [restoreMode, setRestoreMode] = useState('replace')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef()

  const handleSaveSettings = async () => {
    if (!start || !end) { toast.error('Choose both start and end dates.'); return }
    if (end < start) { toast.error('End date must be after start date.'); return }
    setSavingSettings(true)
    try {
      await saveSettings({ academicStart: start, academicEnd: end, satHoliday: sat, sunHoliday: sun })
      toast.success('Settings saved.')
    } catch (e) { toast.error(`Could not save: ${e.message}`) }
    finally { setSavingSettings(false) }
  }

  const handleBackup = async () => {
    setBusy(true)
    try {
      const { filename, counts } = await createMasterBackup()
      toast.success(`Backup downloaded: ${filename}`)
      setBackupOpen({ counts })
    } catch (e) { toast.error(`Backup failed: ${e.message}`) }
    finally { setBusy(false) }
  }

  const handleRestoreFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const backup = await readBackupFile(file)
      const summary = {
        sourceProfile: backup.sourceProfile,
        counts: backup.counts,
        createdAt: backup.createdAt,
      }
      setRestoreOpen({ backup, summary })
    } catch (err) { toast.error(err.message) }
    finally { setBusy(false) }
  }

  const handleRestoreConfirm = async () => {
    if (!restoreOpen) return
    setBusy(true)
    try {
      if (restoreMode === 'replace') {
        await restoreReplace(restoreOpen.backup)
        toast.success('Data replaced from backup.')
      } else {
        const { conflicts } = await restoreMerge(restoreOpen.backup)
        toast.success(`Merge complete.${conflicts.length ? ` ${conflicts.length} conflict(s) remapped.` : ''}`)
      }
      await reloadAfterRestore()
      setRestoreOpen(null)
    } catch (e) { toast.error(`Restore failed: ${e.message}`) }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-5">
      {/* Academic Year */}
      <section className="card p-5">
        <div className="mb-3 flex items-center gap-2">
          <CalendarRange className="h-5 w-5 text-brand-500" />
          <h2 className="font-semibold">Academic Year</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input id="ayStart" label="Start date" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <Input id="ayEnd" label="End date" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div className="mt-4">
          <Button onClick={handleSaveSettings} loading={savingSettings}>
            <Check className="h-4 w-4" /> Save academic year
          </Button>
        </div>
      </section>

      {/* Weekend behavior */}
      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Weekend Behaviour</h2>
        <div className="space-y-3">
          <Toggle
            label="Treat Saturdays as holidays"
            checked={sat}
            onChange={setSat}
          />
          <Toggle
            label="Treat Sundays as holidays"
            checked={sun}
            onChange={setSun}
          />
        </div>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Individual weekend dates can be overridden as working days in Holiday Manager.
        </p>
        <div className="mt-4">
          <Button onClick={handleSaveSettings} loading={savingSettings}>Save weekend settings</Button>
        </div>
      </section>

      {/* Appearance */}
      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Appearance</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setTheme('light')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 p-4 transition ${theme === 'light' ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-slate-200 dark:border-slate-700'}`}
          >
            <Sun className="h-5 w-5" /> Light
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 p-4 transition ${theme === 'dark' ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-slate-200 dark:border-slate-700'}`}
          >
            <Moon className="h-5 w-5" /> Dark
          </button>
        </div>
      </section>

      {/* Backup & Restore */}
      <section className="card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Database className="h-5 w-5 text-brand-500" />
          <h2 className="font-semibold">Master Backup & Restore</h2>
        </div>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Back up the current profile ({mode === 'online' ? 'online' : 'offline'}) or restore a backup into it.
          Online and offline data never merge automatically.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={handleBackup} loading={busy}>
            <Download className="h-4 w-4" /> Create Master Backup
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload className="h-4 w-4" /> Restore Master Backup
          </Button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleRestoreFile} />
        </div>
      </section>

      {/* About */}
      <section className="card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Info className="h-5 w-5 text-brand-500" />
          <h2 className="font-semibold">About</h2>
        </div>
        <dl className="space-y-2 text-sm">
          <Row label="App">Attendance Manager for Schools</Row>
          <Row label="Version">4.0.0</Row>
          <Row label="Profile">{mode === 'online' ? `Online · ${user?.email}` : 'Offline (this device)'}</Row>
          <Row label="Developed by">Jeevan Varghese</Row>
          <Row label="Visit">
            <a href="https://itsjeevanvarghese.web.app" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline dark:text-brand-400">
              https://itsjeevanvarghese.web.app
            </a>
          </Row>
        </dl>
      </section>

      {/* Backup summary modal */}
      <Modal
        open={!!backupOpen}
        onClose={() => setBackupOpen(false)}
        title="Backup created"
        size="sm"
        footer={<Button onClick={() => setBackupOpen(false)}>Done</Button>}
      >
        {backupOpen && (
          <div className="space-y-2 text-sm">
            <p className="text-slate-600 dark:text-slate-300">Your backup file was downloaded. It contains:</p>
            <ul className="space-y-1 text-slate-500 dark:text-slate-400">
              <li>{backupOpen.counts.classes} classes</li>
              <li>{backupOpen.counts.students} students</li>
              <li>{backupOpen.counts.attendance} attendance records</li>
              <li>{backupOpen.counts.holidays} holidays</li>
              <li>{backupOpen.counts.holidayOverrides} weekend overrides</li>
            </ul>
            <p className="pt-2 text-xs text-slate-400">Passwords, tokens, and secrets are never included.</p>
          </div>
        )}
      </Modal>

      {/* Restore modal */}
      <Modal
        open={!!restoreOpen}
        onClose={() => setRestoreOpen(null)}
        title="Restore backup"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRestoreOpen(null)}>Cancel</Button>
            <Button variant={restoreMode === 'replace' ? 'danger' : 'primary'} onClick={handleRestoreConfirm} loading={busy}>
              {restoreMode === 'replace' ? 'Replace data' : 'Merge data'}
            </Button>
          </>
        }
      >
        {restoreOpen && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
              <p><strong>Source:</strong> {restoreOpen.summary.sourceProfile}</p>
              <p><strong>Created:</strong> {new Date(restoreOpen.summary.createdAt).toLocaleString()}</p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {restoreOpen.summary.counts.classes} classes · {restoreOpen.summary.counts.students} students · {restoreOpen.summary.counts.attendance} attendance records
              </p>
            </div>
            <Field label="Restore mode">
              <div className="space-y-2">
                <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <input type="radio" name="restoreMode" checked={restoreMode === 'replace'} onChange={() => setRestoreMode('replace')} className="mt-1" />
                  <div>
                    <p className="text-sm font-medium">Replace current data (recommended)</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Erases all current profile data and restores from the backup. Other profiles are untouched.</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <input type="radio" name="restoreMode" checked={restoreMode === 'merge'} onChange={() => setRestoreMode('merge')} className="mt-1" />
                  <div>
                    <p className="text-sm font-medium">Merge with current data</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Keeps current records and imports non-conflicting ones. Conflicts are remapped with new IDs.</p>
                  </div>
                </label>
              </div>
            </Field>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[1.375rem]' : 'left-0.5'}`} />
      </button>
    </label>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  )
}
