// Firebase Authentication wrapper.
// Only the online mode uses this. No signup — login only.

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
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

export async function signUp(email, password, displayName = '') {
  if (!isFirebaseConfigured) throw new Error('Firebase is not configured.')
  await setPersistence(auth, browserLocalPersistence)
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  if (displayName.trim()) await updateProfile(cred.user, { displayName: displayName.trim() })
  return cred.user
}

export async function loginWithGoogle() {
  if (!isFirebaseConfigured) throw new Error('Firebase is not configured.')
  await setPersistence(auth, browserLocalPersistence)
  return (await signInWithPopup(auth, new GoogleAuthProvider())).user
}

export async function resetPassword(email) {
  if (!isFirebaseConfigured) throw new Error('Firebase is not configured.')
  await sendPasswordResetEmail(auth, email)
}

export async function sendCurrentUserVerification() {
  if (!auth?.currentUser) throw new Error('Sign in before requesting email verification.')
  await sendEmailVerification(auth.currentUser)
}

export async function refreshCurrentUser() {
  if (!auth?.currentUser) return null
  await auth.currentUser.reload()
  return auth.currentUser
}

export async function logout() {
  if (!isFirebaseConfigured) return
  await signOut(auth)
}

export { isFirebaseConfigured }
