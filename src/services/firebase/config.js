// Firebase initialization.
// Reads config from Vite env vars (see .env.example). When the config is missing
// or incomplete, online mode is disabled gracefully and the app falls back to a
// clear "configure Firebase" message — offline mode still works fully.

import { initializeApp, getApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  disableNetwork,
  enableNetwork,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseConfig = cfg

export const isFirebaseConfigured = Boolean(
  cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId
)

let app = null
let auth = null
let db = null
let functions = null
let networkEnabled = false
let networkChange = Promise.resolve()

if (isFirebaseConfigured) {
  app = getApps().length ? getApp() : initializeApp(cfg)
  auth = getAuth(app)
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })
  functions = getFunctions(app, 'us-central1')
  // Revalidate Access Manager permission before queued protected writes are
  // ever allowed to reach Firestore.
  networkChange = disableNetwork(db).catch((error) => {
    console.warn('[Attendance Sync] Could not disable Firestore during startup.', error?.code || error?.message)
  })
}

export async function setFirestoreNetworkEnabled(enabled) {
  if (!db) return
  networkChange = networkChange.then(async () => {
    if (networkEnabled === enabled) return
    if (enabled) await enableNetwork(db)
    else await disableNetwork(db)
    networkEnabled = enabled
  })
  return networkChange
}

export function isFirestoreNetworkEnabled() {
  return networkEnabled
}

export { app, auth, db, functions }
