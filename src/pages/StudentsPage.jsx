// Students page — class selector, list, add/edit/delete/move, search, sort,
// CSV import/export/template. Roll numbers unique within a class.

import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Plus, Pencil, Trash2, ArrowRightLeft, Search, Upload, Download, FileDown, Users, ListChecks,
} from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useToast } from '@/context/ToastContext'
import { sortByRollNumber, normalizeRoll } from '@/utils/sort'
import { parseCsv, parseStudentCsv, studentsToCsv, toCsv, downloadText, BLANK_TEMPLATE } from '@/utils/csv'
import { validateStudent } from '@/validation/backup'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import Input, { Field } from '@/components/ui/Input'
import Select from '@/components/ui/Select'

export default function StudentsPage() {
  const {
    classes, activeClassId, students, studentsInClass,
    addStudent, updateStudent, bulkUpdateStudentRollNumbers, deleteStudent, moveStudent, rollExists, bulkAddStudents,
  } = useData()
  const toast = useToast()

  const [selectedClassId, setSelectedClassId] = useState(activeClassId || '')
  useEffect(() => { setSelectedClassId(activeClassId || '') }, [activeClassId])

  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [moveTarget, setMoveTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [bulkRollOpen, setBulkRollOpen] = useState(false)
  const [bulkRollDraft, setBulkRollDraft] = useState({})
  const [bulkRollConflicts, setBulkRollConflicts] = useState({})
  const [bulkRollImportError, setBulkRollImportError] = useState('')
  const [bulkRollStatus, setBulkRollStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef()
  const bulkRollFileRef = useRef()
  const bulkRollExportGuardRef = useRef(false)

  const list = useMemo(() => {
    const inClass = studentsInClass(selectedClassId)
    const filtered = search.trim()
      ? inClass.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || String(s.rollNumber).toLowerCase().includes(search.toLowerCase()))
      : inClass
    return sortByRollNumber(filtered)
  }, [students, selectedClassId, search, studentsInClass])

  // ---- Add/Edit form state ----
  const [formRoll, setFormRoll] = useState('')
  const [formName, setFormName] = useState('')
  const [formError, setFormError] = useState('')

  const resetForm = () => { setFormRoll(''); setFormName(''); setFormError('') }

  const openAdd = () => { resetForm(); setAddOpen(true) }
  const openEdit = (s) => { setFormRoll(s.rollNumber); setFormName(s.name); setFormError(''); setEditTarget(s) }

  const submitAdd = async () => {
    const err = validateStudent({ rollNumber: formRoll, name: formName })
    if (err) return setFormError(err)
    const roll = normalizeRoll(formRoll)
    try {
      if (await rollExists(selectedClassId, roll)) return setFormError(`Roll number "${roll}" already exists in this class.`)
    } catch (e) { return setFormError('Could not verify roll number.') }
    setBusy(true)
    try {
      await addStudent({ classId: selectedClassId, rollNumber: roll, name: formName.trim() })
      toast.success('Student added.')
      setAddOpen(false); resetForm()
    } catch (e) { setFormError(e.message) }
    finally { setBusy(false) }
  }

  const submitEdit = async () => {
    const err = validateStudent({ rollNumber: formRoll, name: formName })
    if (err) return setFormError(err)
    const roll = normalizeRoll(formRoll)
    try {
      if (await rollExists(selectedClassId, roll, editTarget.id)) return setFormError(`Roll number "${roll}" already exists in this class.`)
    } catch (e) { return setFormError('Could not verify roll number.') }
    setBusy(true)
    try {
      await updateStudent({ ...editTarget, rollNumber: roll, name: formName.trim() })
      toast.success('Student updated.')
      setEditTarget(null); resetForm()
    } catch (e) { setFormError(e.message) }
    finally { setBusy(false) }
  }

  const submitMove = async (newClassId) => {
    if (!newClassId || newClassId === moveTarget.classId) { setMoveTarget(null); return }
    try {
      if (await rollExists(newClassId, moveTarget.rollNumber)) {
        toast.error(`Roll number "${moveTarget.rollNumber}" already exists in that class.`)
        return
      }
    } catch (e) { return toast.error('Could not verify roll number.') }
    setBusy(true)
    try {
      await moveStudent(moveTarget.id, newClassId)
      toast.success('Student moved. Attendance history preserved.')
      setMoveTarget(null)
    } catch (e) { toast.error(e.message) }
    finally { setBusy(false) }
  }

  const submitDelete = async () => {
    setBusy(true)
    try {
      await deleteStudent(deleteTarget.id)
      toast.success('Student deleted.')
      setDeleteTarget(null)
    } catch (e) { toast.error(e.message) }
    finally { setBusy(false) }
  }

  // ---- CSV ----
  const handleExport = () => {
    if (!selectedClassId) return
    const csv = studentsToCsv(studentsInClass(selectedClassId))
    const className = classes.find(c => c.id === selectedClassId)?.name || 'class'
    downloadText(`students-${className.replace(/\s+/g, '-').toLowerCase()}.csv`, csv)
    toast.success('Exported CSV.')
  }

  const handleTemplate = () => {
    downloadText('student-template.csv', BLANK_TEMPLATE)
    toast.success('Blank template downloaded.')
  }

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const text = await file.text()
      const { rows, errors } = parseStudentCsv(text)
      if (errors.length && rows.length === 0) {
        toast.error(`Import failed: ${errors[0]}`)
        return
      }
      // Check for duplicates already existing in the class.
      const existing = studentsInClass(selectedClassId)
      const existingRolls = new Set(existing.map(s => normalizeRoll(s.rollNumber)))
      const toAdd = []
      let skipped = 0
      const failed = [...errors]
      for (const r of rows) {
        if (existingRolls.has(normalizeRoll(r.rollNumber))) { skipped++; failed.push(`Skipped: roll "${r.rollNumber}" already exists.`) }
        else { toAdd.push(r); existingRolls.add(normalizeRoll(r.rollNumber)) }
      }
      if (toAdd.length) await bulkAddStudents(selectedClassId, toAdd)
      toast.success(`Imported ${toAdd.length}, skipped ${skipped}.`)
      if (failed.length) setImportOpen({ rows: toAdd.length, skipped, failed })
      else setImportOpen(null)
    } catch (e) { toast.error(`Import failed: ${e.message}`) }
    finally { setBusy(false) }
  }

  // ---- Bulk roll-number editing ----
  const bulkRollStudents = useMemo(
    () => sortByRollNumber(studentsInClass(selectedClassId)),
    [students, selectedClassId, studentsInClass]
  )

  const openBulkRollEditor = () => {
    const draft = Object.fromEntries(bulkRollStudents.map(s => [s.id, String(s.rollNumber)]))
    setBulkRollDraft(draft)
    setBulkRollConflicts(validateBulkRollNumbers(bulkRollStudents, draft))
    setBulkRollImportError('')
    setBulkRollStatus('')
    setBulkRollOpen(true)
  }

  const changeBulkRoll = (studentId, value) => {
    const next = { ...bulkRollDraft, [studentId]: value }
    setBulkRollDraft(next)
    setBulkRollConflicts(validateBulkRollNumbers(bulkRollStudents, next))
    setBulkRollImportError('')
    setBulkRollStatus('')
  }

  const applyBulkRollNumbers = async () => {
    const conflicts = validateBulkRollNumbers(bulkRollStudents, bulkRollDraft)
    setBulkRollConflicts(conflicts)
    if (Object.keys(conflicts).length) return

    const currentRollById = new Map(bulkRollStudents.map(s => [s.id, normalizeRoll(s.rollNumber)]))
    const updates = bulkRollStudents
      .map(s => ({ studentId: s.id, rollNumber: normalizeRoll(bulkRollDraft[s.id]) }))
      .filter(update => update.rollNumber !== currentRollById.get(update.studentId))

    if (!updates.length) {
      setBulkRollStatus('No roll-number changes to apply.')
      return
    }

    setBusy(true)
    try {
      await bulkUpdateStudentRollNumbers({ classId: selectedClassId, updates })
      const appliedRollById = new Map(updates.map(update => [update.studentId, update.rollNumber]))
      const refreshedDraft = Object.fromEntries(bulkRollStudents.map(student => [
        student.id,
        appliedRollById.get(student.id) ?? normalizeRoll(student.rollNumber),
      ]))
      setBulkRollDraft(refreshedDraft)
      setBulkRollConflicts({})
      setBulkRollImportError('')
      setBulkRollStatus(`Applied ${updates.length} roll-number change${updates.length === 1 ? '' : 's'}. The table has been refreshed.`)
      toast.success(`Updated ${updates.length} roll number${updates.length === 1 ? '' : 's'}. Attendance history preserved.`)
    } catch (e) {
      toast.error(`Could not update roll numbers: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  const exportBulkRollCsv = (event) => {
    event?.preventDefault()
    event?.stopPropagation()
    bulkRollExportGuardRef.current = true
    const rows = [['studentId', 'currentRollNumber', 'studentName', 'newRollNumber']]
    bulkRollStudents.forEach(student => rows.push([
      student.id,
      student.rollNumber,
      student.name,
      bulkRollDraft[student.id] ?? student.rollNumber,
    ]))
    const className = classes.find(c => c.id === selectedClassId)?.name || 'class'
    downloadText(`roll-number-updates-${className.replace(/\s+/g, '-').toLowerCase()}.csv`, toCsv(rows))
    setBulkRollOpen(true)
    toast.success('Bulk roll-number CSV exported.')
    window.setTimeout(() => { bulkRollExportGuardRef.current = false }, 500)
  }

  const closeBulkRollEditor = () => {
    if (busy || bulkRollExportGuardRef.current) return
    setBulkRollOpen(false)
  }

  const importBulkRollCsv = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const parsed = parseBulkRollCsv(await file.text(), bulkRollStudents)
      if (parsed.errors.length) {
        setBulkRollImportError(parsed.errors.join(' '))
        setBulkRollStatus('')
        return
      }
      const next = { ...bulkRollDraft, ...parsed.values }
      const conflicts = validateBulkRollNumbers(bulkRollStudents, next)
      const changedCount = bulkRollStudents.filter(student => (
        normalizeRoll(next[student.id]) !== normalizeRoll(student.rollNumber)
      )).length
      setBulkRollDraft(next)
      setBulkRollConflicts(conflicts)
      setBulkRollImportError('')
      setBulkRollStatus(
        changedCount
          ? `CSV preview loaded with ${changedCount} pending change${changedCount === 1 ? '' : 's'}. Review the table, then select Apply Changes.`
          : 'CSV preview loaded, but it contains no roll-number changes.'
      )
    } catch (e) {
      setBulkRollImportError(`Could not import CSV: ${e.message}`)
      setBulkRollStatus('')
    }
  }

  if (!selectedClassId) {
    return <EmptyState icon={Users} title="Select a class" description="Create a class first, then select it here to manage students." />
  }

  return (
    <div className="space-y-4">
      {/* Top controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Select
            label="Class"
            id="studentClassSelect"
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="min-w-[12rem]"
          >
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input-base pl-9"
              placeholder="Search name or roll…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search students"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={openBulkRollEditor} disabled={!bulkRollStudents.length}>
            <ListChecks className="h-4 w-4" /> Bulk Edit Roll Numbers
          </Button>
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} loading={busy}>
            <Upload className="h-4 w-4" /> Import CSV
          </Button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFile} />
          <Button variant="secondary" size="sm" onClick={handleExport}><Download className="h-4 w-4" /> Export CSV</Button>
          <Button variant="secondary" size="sm" onClick={handleTemplate}><FileDown className="h-4 w-4" /> Template</Button>
          <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4" /> Add student</Button>
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        {list.length} student{list.length !== 1 ? 's' : ''} in {classes.find(c => c.id === selectedClassId)?.name}
      </p>

      {/* List */}
      {list.length === 0 ? (
        <EmptyState icon={Users} title="No students" description="Add students one by one or import a CSV to get started." action={<Button onClick={openAdd}><Plus className="h-4 w-4" /> Add student</Button>} />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Roll No</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {list.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-medium">{s.rollNumber}</td>
                  <td className="px-4 py-3">{s.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(s)} className="btn-ghost p-1.5" aria-label={`Edit ${s.name}`}><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => setMoveTarget(s)} className="btn-ghost p-1.5" aria-label={`Move ${s.name}`}><ArrowRightLeft className="h-4 w-4" /></button>
                      <button onClick={() => setDeleteTarget(s)} className="btn-ghost p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20" aria-label={`Delete ${s.name}`}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk roll-number editor */}
      <Modal
        open={bulkRollOpen}
        onClose={closeBulkRollEditor}
        title="Bulk Edit Roll Numbers"
        size="xl"
        footer={<>
          <Button variant="secondary" onClick={closeBulkRollEditor} disabled={busy}>Close</Button>
          <Button onClick={applyBulkRollNumbers} loading={busy} disabled={Object.keys(bulkRollConflicts).length > 0}>
            Apply Changes
          </Button>
        </>}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Updates use each student's internal ID, so attendance history and reports remain linked.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={exportBulkRollCsv}>
                <Download className="h-4 w-4" /> Export Updates CSV
              </Button>
              <Button variant="secondary" size="sm" onClick={() => bulkRollFileRef.current?.click()}>
                <Upload className="h-4 w-4" /> Import Updates CSV
              </Button>
              <input
                ref={bulkRollFileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={importBulkRollCsv}
              />
            </div>
          </div>

          {bulkRollImportError && (
            <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
              {bulkRollImportError}
            </p>
          )}

          {bulkRollStatus && (
            <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-700 dark:bg-brand-900/20 dark:text-brand-300">
              {bulkRollStatus}
            </p>
          )}

          {Object.keys(bulkRollConflicts).length > 0 && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
              Resolve the highlighted roll-number conflicts before saving.
            </p>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[42rem] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Current Roll Number</th>
                  <th className="px-4 py-3 font-medium">Student Name</th>
                  <th className="px-4 py-3 font-medium">New Roll Number</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {bulkRollStudents.map(student => {
                  const conflict = bulkRollConflicts[student.id]
                  const changed = normalizeRoll(bulkRollDraft[student.id]) !== normalizeRoll(student.rollNumber)
                  return (
                    <tr key={student.id} className={changed ? 'bg-brand-50/70 dark:bg-brand-900/10' : ''}>
                      <td className="px-4 py-3 font-medium">{student.rollNumber}</td>
                      <td className="px-4 py-3">{student.name}</td>
                      <td className="px-4 py-3">
                        <input
                          className={`input-base ${conflict ? 'border-rose-500 focus:border-rose-500' : ''}`}
                          value={bulkRollDraft[student.id] ?? ''}
                          onChange={(e) => changeBulkRoll(student.id, e.target.value)}
                          aria-label={`New roll number for ${student.name}`}
                          aria-invalid={!!conflict}
                        />
                        {conflict && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{conflict}</p>}
                        {!conflict && changed && <p className="mt-1 text-xs text-brand-600 dark:text-brand-400">Pending change</p>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* Add modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add student"
        size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button onClick={submitAdd} loading={busy}>Add</Button>
        </>}
      >
        <div className="space-y-3">
          <Input id="addRoll" label="Roll number" value={formRoll} onChange={(e) => setFormRoll(e.target.value)} error={formError} autoFocus />
          <Input id="addName" label="Name" value={formName} onChange={(e) => setFormName(e.target.value)} />
          <p className="text-xs text-slate-400">Roll numbers must be unique within this class.</p>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit student"
        size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setEditTarget(null)}>Cancel</Button>
          <Button onClick={submitEdit} loading={busy}>Save</Button>
        </>}
      >
        <div className="space-y-3">
          <Input id="editRoll" label="Roll number" value={formRoll} onChange={(e) => setFormRoll(e.target.value)} error={formError} />
          <Input id="editName" label="Name" value={formName} onChange={(e) => setFormName(e.target.value)} />
        </div>
      </Modal>

      {/* Move modal */}
      <Modal
        open={!!moveTarget}
        onClose={() => setMoveTarget(null)}
        title="Move student"
        size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setMoveTarget(null)}>Cancel</Button>
        </>}
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Move <strong>{moveTarget?.name}</strong> (Roll {moveTarget?.rollNumber}) to another class.
            Attendance history is preserved.
          </p>
          <Field label="Destination class">
            <div className="space-y-2">
              {classes.filter(c => c.id !== moveTarget?.classId).map(c => (
                <button
                  key={c.id}
                  onClick={() => submitMove(c.id)}
                  disabled={busy}
                  className="btn-secondary w-full justify-start"
                >
                  {c.name}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </Modal>

      {/* Import summary */}
      {importOpen && (
        <Modal
          open={!!importOpen}
          onClose={() => setImportOpen(null)}
          title="Import summary"
          size="md"
          footer={<Button onClick={() => setImportOpen(null)}>Close</Button>}
        >
          <div className="space-y-3">
            <div className="flex gap-4">
              <Stat label="Imported" value={importOpen.rows} color="text-emerald-600" />
              <Stat label="Skipped" value={importOpen.skipped} color="text-amber-600" />
            </div>
            {importOpen.failed.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800">
                {importOpen.failed.map((f, i) => <p key={i} className="text-slate-600 dark:text-slate-400">{f}</p>)}
              </div>
            )}
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={submitDelete}
        loading={busy}
        title="Delete student?"
        message={`This permanently deletes "${deleteTarget?.name}" and all attendance records. This cannot be undone.`}
        confirmLabel="Delete"
      />
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}

function validateBulkRollNumbers(students, draft) {
  const conflicts = {}
  const idsByRoll = new Map()

  students.forEach(student => {
    const roll = normalizeRoll(draft[student.id])
    if (!roll) {
      conflicts[student.id] = 'Roll number is required.'
      return
    }
    const key = roll.toLocaleLowerCase()
    const ids = idsByRoll.get(key) || []
    ids.push(student.id)
    idsByRoll.set(key, ids)
  })

  idsByRoll.forEach(ids => {
    if (ids.length < 2) return
    ids.forEach(id => { conflicts[id] = `Duplicate roll number "${normalizeRoll(draft[id])}".` })
  })

  return conflicts
}

function parseBulkRollCsv(text, students) {
  const rows = parseCsv(text)
  if (!rows.length) return { values: {}, errors: ['The CSV file is empty.'] }

  const normalizeHeader = value => String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
  const header = rows[0].map(normalizeHeader)
  const idIndex = header.indexOf('studentid')
  const newRollIndex = header.indexOf('newrollnumber')
  if (idIndex === -1 || newRollIndex === -1) {
    return { values: {}, errors: ['CSV must contain studentId and newRollNumber columns.'] }
  }

  const validIds = new Set(students.map(student => student.id))
  const seenIds = new Set()
  const values = {}
  const errors = []

  rows.slice(1).forEach((row, index) => {
    const studentId = String(row[idIndex] || '').trim()
    const rollNumber = String(row[newRollIndex] || '').trim()
    if (!studentId && !rollNumber) return
    if (!studentId) {
      errors.push(`Row ${index + 2}: missing studentId.`)
      return
    }
    if (!validIds.has(studentId)) {
      errors.push(`Row ${index + 2}: studentId does not belong to the selected class.`)
      return
    }
    if (seenIds.has(studentId)) {
      errors.push(`Row ${index + 2}: duplicate studentId.`)
      return
    }
    seenIds.add(studentId)
    values[studentId] = rollNumber
  })

  return { values, errors }
}
