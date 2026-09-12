// Auth context — tracks the current mode (online/offline) and the Firebase user.
// Online: waits for Firebase Auth to initialize before reporting ready.
// Offline: ready immediately, user is null.

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { subscribeToAuth, login as fbLogin, logout as fbLogout, isFirebaseConfigured } from '@/services/firebase/auth'
import { setMode } from '@/repositories/repo'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [mode, setModeState] = useState('startup') // 'startup' | 'online' | 'offline'
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    const unsub = subscribeToAuth(({ user, ready }) => {
      // Switch the repository away from Firestore before publishing a null
      // user. Otherwise DataProvider can briefly start a new online load after
      // Firebase has already revoked the session during sign-out.
      if (ready && !user) {
        setMode('offline', null)
        setModeState((current) => current === 'online' ? 'startup' : current)
      }
      setUser(user)
      setAuthReady(ready)
      if (ready && user) {
        setModeState('online')
        setMode('online', user.uid)
      }
    })
    return unsub
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const enterOnline = useCallback(async (email, password) => {
    const u = await fbLogin(email, password)
    setUser(u)
    setModeState('online')
    setMode('online', u.uid)
    return u
  }, [])

  const enterOffline = useCallback(() => {
    setUser(null)
    setModeState('offline')
    setMode('offline', null)
  }, [])

  const signOut = useCallback(async () => {
    // Stop online repository work immediately; the Firebase callback will
    // confirm the signed-out state once logout completes.
    setMode('offline', null)
    setModeState('startup')
    setUser(null)
    try {
      await fbLogout()
    } catch (error) {
      // Restore the online session if Firebase could not complete sign-out.
      if (user) {
        setUser(user)
        setModeState('online')
        setMode('online', user.uid)
      }
      throw error
    }
  }, [user])

  return (
    <AuthContext.Provider value={{
      mode, user, authReady, isFirebaseConfigured,
      enterOnline, enterOffline, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
