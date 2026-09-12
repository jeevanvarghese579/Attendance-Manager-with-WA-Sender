// Theme context — light/dark, persisted in localStorage and IndexedDB.

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getPref, setPref, PREF_THEME } from '@/services/indexeddb/database'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    const stored = localStorage.getItem('theme')
    const initial = stored || 'light'
    applyTheme(initial)
    setTheme(initial)
    getPref(PREF_THEME, null).then((pref) => {
      if (!active) return
      if (pref) { applyTheme(pref); setTheme(pref) }
      setLoaded(true)
    }).catch(() => setLoaded(true))
    return () => { active = false }
  }, [])

  const applyTheme = (t) => {
    const root = document.documentElement
    if (t === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    localStorage.setItem('theme', t)
  }

  const changeTheme = useCallback((t) => {
    applyTheme(t)
    setTheme(t)
    setPref(PREF_THEME, t).catch(() => {})
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme: changeTheme, loaded }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
