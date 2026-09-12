import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import {
  subscribeToAuth,
  login as fbLogin,
  signUp as fbSignUp,
  loginWithGoogle as fbGoogleLogin,
  resetPassword as fbResetPassword,
  sendCurrentUserVerification,
  refreshCurrentUser,
  logout as fbLogout,
  isFirebaseConfigured,
} from '@/services/firebase/auth'
import {
  ACCESS_MESSAGES,
  FIREBASE_APP_ID,
  accessKind,
  checkCurrentUserAccess,
  isConnectivityError,
  requestCurrentUserAccess,
} from '@/services/firebase/access'
import { setFirestoreNetworkEnabled } from '@/services/firebase/config'
import { flushPendingWrites, setSyncState, subscribeToSyncState } from '@/services/firebase/sync'
import { cacheAuthorization, getCachedAuthorization } from '@/services/indexeddb/database'
import { setMode } from '@/repositories/repo'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [mode, setModeState] = useState('startup')
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [access, setAccess] = useState({ kind: 'unknown' })
  const [syncStatus, setSyncStatus] = useState('offline')
  const requestTypeRef = useRef('access-request')
  const evaluationRef = useRef(0)
  const userRef = useRef(null)

  const activateCachedAuthorization = useCallback(async (candidate, token) => {
    const cached = await getCachedAuthorization(candidate.uid, FIREBASE_APP_ID, candidate.email)
    if (token !== evaluationRef.current) return false
    if (!cached) return false
    await setFirestoreNetworkEnabled(false)
    setMode('online', candidate.uid)
    setModeState('online')
    setAccess({ kind: 'offline-authorized', allowed: true, cachedAt: cached.checkedAt })
    setSyncState('offline')
    return true
  }, [])

  const evaluateAccess = useCallback(async (candidate, requestType = 'access-request') => {
    const token = ++evaluationRef.current
    setMode('offline', null)
    setModeState('startup')
    setAccess({ kind: 'checking' })
    setSyncState(navigator.onLine ? 'syncing' : 'offline')
    try {
      if (!navigator.onLine) {
        if (await activateCachedAuthorization(candidate, token)) return
        setAccess({ kind: 'offline-unavailable', message: ACCESS_MESSAGES.offlineUnavailable })
        return
      }
      await refreshCurrentUser()
      const check = await checkCurrentUserAccess(candidate)
      if (token !== evaluationRef.current) return
      const kind = accessKind(check)
      if (kind !== 'allowed') {
        await setFirestoreNetworkEnabled(false)
        setAccess({ ...check, kind, requestType })
        setSyncState('offline')
        return
      }
      if (check.uid !== candidate.uid) throw new Error('Access Manager returned a UID that does not match the signed-in Firebase user.')
      await cacheAuthorization(candidate.uid, FIREBASE_APP_ID, candidate.email)
      await setFirestoreNetworkEnabled(true)
      if (token !== evaluationRef.current) return
      setMode('online', candidate.uid)
      setModeState('online')
      setAccess({ ...check, kind: 'allowed', requestType })
      flushPendingWrites()
    } catch (error) {
      if (token !== evaluationRef.current) return
      await setFirestoreNetworkEnabled(false)
      if (isConnectivityError(error) && await activateCachedAuthorization(candidate, token)) return
      console.error('[Attendance Auth] Authorization failed.', error?.code || error?.message)
      setAccess({ kind: isConnectivityError(error) ? 'offline-unavailable' : 'error', message: error?.message })
      setSyncState(isConnectivityError(error) ? 'offline' : 'failed')
    }
  }, [activateCachedAuthorization])

  useEffect(() => subscribeToSyncState(setSyncStatus), [])

  useEffect(() => {
    const unsub = subscribeToAuth(({ user: nextUser, ready }) => {
      userRef.current = nextUser
      setUser(nextUser)
      setAuthReady(ready)
      if (!ready) return
      if (!nextUser) {
        ++evaluationRef.current
        setMode('offline', null)
        setModeState((current) => current === 'offline' ? current : 'startup')
        setAccess({ kind: 'unknown' })
        setFirestoreNetworkEnabled(false)
        return
      }
      const requestType = requestTypeRef.current
      requestTypeRef.current = 'access-request'
      evaluateAccess(nextUser, requestType)
    })
    return unsub
  }, [evaluateAccess])

  useEffect(() => {
    const goOffline = async () => {
      await setFirestoreNetworkEnabled(false)
      setSyncState('offline')
      if (userRef.current && mode === 'online') {
        setAccess((current) => current.kind === 'allowed' ? { ...current, kind: 'offline-authorized' } : current)
      }
    }
    const goOnline = () => {
      if (userRef.current) evaluateAccess(userRef.current, 'access-request')
    }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [evaluateAccess, mode])

  const enterOnline = useCallback(async (email, password) => {
    requestTypeRef.current = 'access-request'
    return fbLogin(email, password)
  }, [])

  const signUp = useCallback(async (email, password, displayName) => {
    requestTypeRef.current = 'new-account'
    return fbSignUp(email, password, displayName)
  }, [])

  const signInWithGoogle = useCallback(async () => {
    requestTypeRef.current = 'access-request'
    return fbGoogleLogin()
  }, [])

  const enterOffline = useCallback(async () => {
    ++evaluationRef.current
    await setFirestoreNetworkEnabled(false)
    if (userRef.current) await fbLogout()
    setUser(null)
    userRef.current = null
    setAccess({ kind: 'unknown' })
    setModeState('offline')
    setMode('offline', null)
    setSyncState('offline')
  }, [])

  const signOut = useCallback(async () => {
    ++evaluationRef.current
    await setFirestoreNetworkEnabled(false)
    setMode('offline', null)
    setModeState('startup')
    setUser(null)
    userRef.current = null
    setAccess({ kind: 'unknown' })
    setSyncState('offline')
    await fbLogout()
  }, [])

  const requestAccess = useCallback(async () => {
    const result = await requestCurrentUserAccess(access.requestType || 'access-request')
    if (result.status === 'already-approved') return evaluateAccess(userRef.current)
    const kind = result.status === 'rejected' ? 'rejected' : result.status === 'approved' ? 'inactive' : 'pending'
    setAccess((current) => ({ ...current, kind, requestStatus: result.status }))
    return result
  }, [access.requestType, evaluateAccess])

  const checkAgain = useCallback(async () => {
    if (!userRef.current) return
    return evaluateAccess(userRef.current, access.requestType || 'access-request')
  }, [access.requestType, evaluateAccess])

  return (
    <AuthContext.Provider value={{
      mode, user, authReady, access, syncStatus, isFirebaseConfigured,
      enterOnline, signUp, signInWithGoogle, resetPassword: fbResetPassword,
      sendVerification: sendCurrentUserVerification, requestAccess, checkAgain,
      enterOffline, signOut,
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
