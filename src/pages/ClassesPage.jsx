// Classes page — create, rename, delete, set default, select active.

import { useState } from 'react'
import { Plus, Pencil, Trash2, Star, BookOpen, Check } from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useToast } from '@/context/ToastContext'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import Input from '@/components/ui/Input'

export default function ClassesPage() {
  const { classes, activeClassId, setActiveClassId, defaultClassId, setDefaultClass, createClass, renameClass, deleteClass, loading } = useData()
  const toast = useToast()
  const [createOpen, setCreateOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState(null)
  const [renameName, setRenameName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error('Enter a class name.'); return }
    setBusy(true)
    try {
      await createClass(newName)
      toast.success('Class created.')
      setNewName('')
      setCreateOpen(false)
    } catch (e) { toast.error(`Could not create class: ${e.message}`) }
    finally { setBusy(false) }
  }

  const handleRename = async () => {
    if (!renameName.trim()) { toast.error('Enter a class name.'); return }
    setBusy(true)
    try {
      await renameClass(renameTarget.id, renameName)
      toast.success('Class renamed.')
      setRenameTarget(null)
    } catch (e) { toast.error(`Could not rename: ${e.message}`) }
    finally { setBusy(false) }
  }

  const handleDelete = async () => {
    setBusy(true)
    try {
      await deleteClass(deleteTarget.id)
      toast.success('Class deleted.')
      setDeleteTarget(null)
    } catch (e) { toast.error(`Could not delete: ${e.message}`) }
    finally { setBusy(false) }
  }

  const createClassModal = (
    <Modal
      open={createOpen}
      onClose={() => setCreateOpen(false)}
      title="Create class"
      size="sm"
      footer={<>
        <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
        <Button onClick={handleCreate} loading={busy}>Create</Button>
      </>}
    >
      <Input id="newClass" label="Class name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Grade 5-A" autoFocus />
    </Modal>
  )

  if (loading) return null
  if (classes.length === 0) {
    return (
      <>
        <EmptyState
          icon={BookOpen}
          title="No classes yet"
          description="Create your first class to start adding students and tracking attendance."
          action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Create class</Button>}
        />
        {createClassModal}
      </>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">Click a class to make it active. Star sets the default class for this device.</p>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New class</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {classes.map((c) => {
          const isActive = c.id === activeClassId
          const isDefault = c.id === defaultClassId
          return (
            <div key={c.id} className={`card p-4 transition ${isActive ? 'ring-2 ring-brand-500' : ''}`}>
              <div className="flex items-start justify-between">
                <button onClick={() => setActiveClassId(c.id)} className="flex-1 text-left">
                  <p className="font-semibold">{c.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {isActive ? 'Active class' : 'Click to activate'}
                  </p>
                </button>
                <button
                  onClick={() => setDefaultClass(c.id)}
                  className={`btn-ghost p-1 ${isDefault ? 'text-accent-500' : ''}`}
                  aria-label={isDefault ? 'Default class' : 'Set as default'}
                  title={isDefault ? 'Default class for this device' : 'Set as default class'}
                >
                  <Star className="h-5 w-5" fill={isDefault ? 'currentColor' : 'none'} />
                </button>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => { setRenameTarget(c); setRenameName(c.name) }}>
                  <Pencil className="h-3.5 w-3.5" /> Rename
                </Button>
                <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20" onClick={() => setDeleteTarget(c)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {createClassModal}

      <Modal
        open={!!renameTarget}
        onClose={() => setRenameTarget(null)}
        title="Rename class"
        size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setRenameTarget(null)}>Cancel</Button>
          <Button onClick={handleRename} loading={busy}>Save</Button>
        </>}
      >
        <Input id="renameClass" label="Class name" value={renameName} onChange={(e) => setRenameName(e.target.value)} autoFocus />
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={busy}
        title="Delete class?"
        message={`This permanently deletes "${deleteTarget?.name}", all its students, and all attendance records. This cannot be undone.`}
        confirmLabel="Delete"
      />
    </div>
  )
}
