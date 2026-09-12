// Logger — structured error logging used by all save operations.

export function logError({ uid = 'offline', operation, collection, recordId, error }) {
  const entry = {
    uid,
    operation,
    collection,
    recordId,
    code: error?.code || 'unknown',
    message: error?.message || String(error),
    stack: error?.stack || null,
    timestamp: new Date().toISOString(),
  }
  // eslint-disable-next-line no-console
  console.error('[AttendanceManager]', entry)
  return entry
}

export function logInfo(...args) {
  // eslint-disable-next-line no-console
  console.info('[AttendanceManager]', ...args)
}
