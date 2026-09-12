// App shell — responsive sidebar (desktop) + drawer (mobile) + main content.

import { useState } from 'react'
import {
  Menu, GraduationCap, Wifi, WifiOff, LogOut, Loader2, CheckCircle2, AlertTriangle,
  CalendarCheck, BookOpen, Users, CalendarDays, ClipboardList, Settings,
} from 'lucide-react'
import { useNav, PANELS } from '@/context/NavContext'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'

const NAV_ITEMS = [
  { key: PANELS.TODAY, label: "Today's Absentees", icon: CalendarCheck },
  { key: PANELS.CLASSES, label: 'Classes', icon: BookOpen },
  { key: PANELS.STUDENTS, label: 'Students', icon: Users },
  { key: PANELS.HOLIDAYS, label: 'Holiday Manager', icon: CalendarDays },
  { key: PANELS.REPORT, label: 'Attendance Report', icon: ClipboardList },
  { key: PANELS.SETTINGS, label: 'Settings', icon: Settings },
]

export default function AppShell({ children }) {
  const { panel, setPanel, drawerOpen, setDrawerOpen } = useNav()
  const { mode, user, signOut, syncStatus } = useAuth()
  const { activeClass } = useData()

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-teal-500 text-white shadow-md">
          <GraduationCap className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">Attendance Manager</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">for Schools</p>
        </div>
      </div>

      <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs dark:bg-slate-800">
        {mode === 'online'
          ? <><Wifi className="h-3.5 w-3.5 text-emerald-500" /><span className="truncate">Online · {user?.email}</span></>
          : <><WifiOff className="h-3.5 w-3.5 text-amber-500" /><span>Offline · this device</span></>}
      </div>

      {mode === 'online' && <SyncBadge status={syncStatus} />}

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = panel === item.key
          return (
            <button
              key={item.key}
              onClick={() => setPanel(item.key)}
              className={[
                'mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                active
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
              ].join(' ')}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        {mode === 'online' && (
          <button onClick={signOut} className="btn-ghost w-full justify-start gap-3">
            <LogOut className="h-5 w-5" /> Sign out
          </button>
        )}
        {activeClass && (
          <p className="mt-2 truncate px-3 text-xs text-slate-400">
            Active class: <span className="font-medium text-slate-600 dark:text-slate-300">{activeClass.name}</span>
          </p>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 border-r border-slate-200 bg-white shadow-xl animate-slide-in-right dark:border-slate-800 dark:bg-slate-900">
            {sidebar}
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 md:px-6">
          <button
            onClick={() => setDrawerOpen(true)}
            className="btn-ghost p-2 md:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="flex-1 truncate text-base font-semibold md:text-lg">
            {NAV_ITEMS.find(n => n.key === panel)?.label}
          </h1>
        </header>
        <main className="flex-1 overflow-y-auto scrollbar-thin p-4 md:p-6">
          <div className="mx-auto max-w-6xl animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  )
}

function SyncBadge({ status }) {
  const detail = status === 'syncing'
    ? { label: 'Syncing', icon: Loader2, color: 'text-sky-600', spin: true }
    : status === 'synced'
      ? { label: 'Synced', icon: CheckCircle2, color: 'text-emerald-600' }
      : status === 'failed'
        ? { label: 'Sync failed', icon: AlertTriangle, color: 'text-rose-600' }
        : { label: 'Offline', icon: WifiOff, color: 'text-amber-600' }
  const Icon = detail.icon
  return (
    <div className={`mx-3 mb-2 flex items-center gap-2 px-3 text-xs ${detail.color}`} role="status">
      <Icon className={`h-3.5 w-3.5 ${detail.spin ? 'animate-spin' : ''}`} />
      <span>{detail.label}</span>
    </div>
  )
}
