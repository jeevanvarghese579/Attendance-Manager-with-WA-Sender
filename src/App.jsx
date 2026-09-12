// Root app component — wires providers and routes between StartPage and AppShell.

import { AuthProvider, useAuth } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { ToastProvider } from '@/context/ToastContext'
import { NavProvider, useNav } from '@/context/NavContext'
import { DataProvider, useData } from '@/context/DataContext'
import { FullPageSpinner } from '@/components/ui/Spinner'
import AppShell from '@/components/layout/AppShell'
import StartPage from '@/pages/StartPage'
import ClassesPage from '@/pages/ClassesPage'
import StudentsPage from '@/pages/StudentsPage'
import TodayAbsencesPage from '@/pages/TodayAbsencesPage'
import HolidayManagerPage from '@/pages/HolidayManagerPage'
import AttendanceReportPage from '@/pages/AttendanceReportPage'
import SettingsPage from '@/pages/SettingsPage'

function PanelRouter() {
  const { panel } = useNav()
  switch (panel) {
    case 'today': return <TodayAbsencesPage />
    case 'classes': return <ClassesPage />
    case 'students': return <StudentsPage />
    case 'holidays': return <HolidayManagerPage />
    case 'report': return <AttendanceReportPage />
    case 'settings': return <SettingsPage />
    default: return <TodayAbsencesPage />
  }
}

function ShellOrStart() {
  const { mode, authReady } = useAuth()
  const { loading } = useData()

  if (mode === 'startup') return <StartPage />
  if (mode === 'online' && !authReady) return <FullPageSpinner label="Connecting…" />
  if (loading) {
    return <AppShell><FullPageSpinner label="Loading your data…" /></AppShell>
  }
  return <AppShell><PanelRouter /></AppShell>
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <NavProvider>
            <DataProvider>
              <ShellOrStart />
            </DataProvider>
          </NavProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
