import { httpsCallable } from 'firebase/functions'
import { app, firebaseConfig, functions } from './config'

export const FIREBASE_APP_ID = firebaseConfig.appId
export const ACCESS_MESSAGES = {
  denied: 'Your account does not currently have access to this application.',
  pending: 'Your access request is awaiting administrator approval.',
  rejected: 'Your access request was not approved. Contact an administrator if you need this decision reviewed.',
  inactive: 'Access was approved, but this account or application is currently inactive. Contact an administrator.',
  verificationRequired: 'Verify your email address before requesting access to this application.',
  offlineUnavailable: 'Connect to the internet once so this account can be authorized before using its cached data offline.',
}

export async function checkCurrentUserAccess(user) {
  if (!functions || !app?.options?.appId) throw new Error('Firebase Access Manager is not configured.')
  const normalizedEmail = user.email?.trim().toLowerCase() || null
  console.info('[Attendance Auth] Checking application access', {
    uid: user.uid, email: normalizedEmail, projectId: app.options.projectId, appId: FIREBASE_APP_ID,
  })
  const result = await httpsCallable(functions, 'checkMyAccess')({ appId: FIREBASE_APP_ID })
  const data = result.data && typeof result.data === 'object' ? result.data : {}
  const access = {
    allowed: data.allowed === true,
    requestStatus: typeof data.requestStatus === 'string' ? data.requestStatus : null,
    requireEmailVerification: data.requireEmailVerification === true,
    emailVerified: data.emailVerified === true,
    role: typeof data.role === 'string' ? data.role : null,
    uid: typeof data.uid === 'string' ? data.uid : user.uid,
    resolvedPermission: data.resolvedPermission || null,
    canonicalAccessDocument: data.canonicalAccessDocument || null,
  }
  console.info('[Attendance Auth] Application access resolved', {
    uid: access.uid,
    email: normalizedEmail,
    projectId: app.options.projectId,
    appId: FIREBASE_APP_ID,
    allowed: access.allowed,
    accountActive: access.canonicalAccessDocument?.active === true,
    permission: access.resolvedPermission,
    canonicalAccessDocument: access.canonicalAccessDocument,
    protectedPath: `attendanceManagerUsers/${user.uid}`,
  })
  return access
}

export async function requestCurrentUserAccess(requestType = 'access-request') {
  const result = await httpsCallable(functions, 'requestAppAccess')({
    appId: FIREBASE_APP_ID,
    requestType: requestType === 'new-account' ? 'new-account' : 'access-request',
  })
  return result.data || {}
}

export function accessKind(check) {
  if (check.allowed) return 'allowed'
  if (check.requestStatus === 'pending') return 'pending'
  if (check.requestStatus === 'rejected') return 'rejected'
  if (check.requestStatus === 'approved') return 'inactive'
  return 'denied'
}

export function isConnectivityError(error) {
  return !navigator.onLine || ['functions/unavailable', 'functions/deadline-exceeded', 'functions/internal'].includes(error?.code)
}
