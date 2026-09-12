// Firebase Authentication wrapper.
// Only the online mode uses this. No signup — login only.

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  browserLocalPersistence,
  setPersistence,
} from 'firebase/auth'
import { auth, isFirebaseConfigured } from './config'

let unsub = null

// Wait until Firebase Auth has fully initialized, then resolve with the
// current user (or null). Prevents loading online data before auth is ready.
export function waitForAuth() {
  return new Promise((resolve) => {
    if (!isFirebaseConfigured) return resolve({ user: null, ready: true })
    if (auth.currentUser !== undefined || auth.currentUser !== null) {
      // still attach listener to be safe; resolve once first callback fires
    }
    if (unsub) unsub()
    unsub = onAuthStateChanged(auth, (user) => {
      resolve({ user, ready: true })
    })
  })
}

export function subscribeToAuth(cb) {
  if (!isFirebaseConfigured) {
    cb({ user: null, ready: true })
    return () => {}
  }
  setPersistence(auth, browserLocalPersistence).catch(() => {})
  return onAuthStateChanged(auth, (user) => {
    cb({ user, ready: true })
  })
}

export async function login(email, password) {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase is not configured. Add your Firebase config to .env to use online mode.')
  }
  await setPersistence(auth, browserLocalPersistence)
  const cred = await signInWithEmailAndPassword(auth, email, password)
  return cred.user
}

export async function logout() {
  if (!isFirebaseConfigured) return
  await signOut(auth)
}

export { isFirebaseConfigured }
