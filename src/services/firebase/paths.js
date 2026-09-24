import { collection, doc } from 'firebase/firestore'
import { db } from './config'

export const APP_KEY = 'attendanceManagerWithWaSender'

export const userRootPath = (uid) => `apps/${APP_KEY}/users/${uid}`
export const userCollection = (uid, name) => collection(db, 'apps', APP_KEY, 'users', uid, name)
export const userDocument = (uid, name, id) => doc(db, 'apps', APP_KEY, 'users', uid, name, id)

