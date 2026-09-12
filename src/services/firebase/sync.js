import { waitForPendingWrites } from 'firebase/firestore'
import { db, isFirestoreNetworkEnabled } from './config'

let state = 'offline'
const listeners = new Set()

export function setSyncState(next) {
  state = next
  listeners.forEach((listener) => listener(next))
}

export function subscribeToSyncState(listener) {
  listeners.add(listener)
  listener(state)
  return () => listeners.delete(listener)
}

export async function trackFirestoreWrite(writePromise) {
  if (!isFirestoreNetworkEnabled()) {
    setSyncState('offline')
    writePromise.catch((error) => {
      setSyncState('failed')
      console.error('[Attendance Sync] Queued write failed.', error?.code || error?.message)
    })
    return
  }
  setSyncState('syncing')
  try {
    await writePromise
    setSyncState('synced')
  } catch (error) {
    setSyncState('failed')
    throw error
  }
}

export async function flushPendingWrites() {
  if (!db || !isFirestoreNetworkEnabled()) return
  setSyncState('syncing')
  try {
    await waitForPendingWrites(db)
    setSyncState('synced')
  } catch (error) {
    setSyncState('failed')
    console.error('[Attendance Sync] Pending-write sync failed.', error?.code || error?.message)
  }
}
