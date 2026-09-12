// Dexie database for offline mode AND device-local preferences (default class,
// theme) that are intentionally never synced to the cloud.
//
// IMPORTANT — PRIMARY KEY RULES:
//   Never change an existing primary key after release. Doing so destroys
//   existing databases on user devices. Only ADD new stores/fields — never
//   rename or remove a primary key. Dexie supports schema evolution by
//   incrementing the version number and only declaring new stores/indexes.

import Dexie from 'dexie'

export const DB_NAME = 'attendance-manager'

export const db = new Dexie(DB_NAME)

// Version 1 — initial schema.
db.version(1).stores({
  // primary key: id (string uuid)
  classes: 'id, name',
  students: 'id, classId, rollNumber, [classId+rollNumber]',
  attendance: 'id, studentId, classId, date, [studentId+date]',
  holidays: 'id, date',
  holidayOverrides: 'id, date',
  settings: 'id',
})

// Open the database and surface a clear error if it cannot open.
let openPromise = null
export function openDatabase() {
  if (!openPromise) {
    openPromise = db.open().catch((e) => {
      throw new Error(`Could not open the on-device database: ${e.message}. Try refreshing the page.`)
    })
  }
  return openPromise
}

// Device-local preferences live in the 'settings' store with fixed ids.
export const PREF_DEFAULT_CLASS = 'defaultClass'
export const PREF_THEME = 'theme'

export async function getPref(key, fallback = null) {
  const row = await db.settings.get(key)
  return row ? row.value : fallback
}

export async function setPref(key, value) {
  await db.settings.put({ id: key, value })
}
