// Navigation context — current active panel + mobile drawer open state.

import { createContext, useContext, useState, useCallback } from 'react'

const NavContext = createContext(null)

export const PANELS = {
  TODAY: 'today',
  CLASSES: 'classes',
  STUDENTS: 'students',
  HOLIDAYS: 'holidays',
  REPORT: 'report',
  SETTINGS: 'settings',
}

export function NavProvider({ children }) {
  const [panel, setPanel] = useState(PANELS.TODAY)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [dirty, setDirty] = useState(false) // unsaved-changes guard

  const go = useCallback((p) => {
    setPanel(p)
    setDrawerOpen(false)
  }, [])

  return (
    <NavContext.Provider value={{
      panel, setPanel: go, drawerOpen, setDrawerOpen, dirty, setDirty,
    }}>
      {children}
    </NavContext.Provider>
  )
}

export function useNav() {
  const ctx = useContext(NavContext)
  if (!ctx) throw new Error('useNav must be used within NavProvider')
  return ctx
}
