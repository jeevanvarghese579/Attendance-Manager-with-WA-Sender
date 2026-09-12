import { useState } from 'react'
import {
  AlertCircle, Cloud, Database, GraduationCap, LogIn, Mail,
  RefreshCw, ShieldCheck, UserPlus, WifiOff,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { ACCESS_MESSAGES } from '@/services/firebase/access'
import { isFirebaseConfigured } from '@/services/firebase/config'

export default function StartPage() {
  const {
    user, access, enterOnline, signUp, signInWithGoogle, resetPassword,
    sendVerification, requestAccess, checkAgain, enterOffline, signOut,
  } = useAuth()
  const toast = useToast()
  const [formMode, setFormMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)

  const run = async (action) => {
    setLoading(true)
    try { await action() }
    catch (error) { toast.error(friendlyAuthError(error)) }
    finally { setLoading(false) }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!email.trim() || !password) return toast.error('Enter your email and password.')
    if (formMode === 'signup' && password.length < 6) return toast.error('Password must be at least 6 characters.')
    run(() => formMode === 'signup'
      ? signUp(email.trim(), password, displayName.trim())
      : enterOnline(email.trim(), password))
  }

  const handleReset = () => {
    if (!email.trim()) return toast.error('Enter your email address first.')
    run(async () => {
      await resetPassword(email.trim())
      toast.success('Password reset email sent.')
    })
  }

  const handleRequest = () => run(async () => {
    try {
      await requestAccess()
    } catch (error) {
      if (error?.code === 'functions/failed-precondition') {
        toast.error(ACCESS_MESSAGES.verificationRequired)
        return
      }
      throw error
    }
  })

  const handleVerification = () => run(async () => {
    await sendVerification()
    toast.success('Verification email sent. Verify your address, then select Check Again.')
  })

  const showAccessGate = Boolean(user) && access.kind !== 'unknown'

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-brand-50/40 to-teal-50/30 p-4 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="hidden flex-col justify-between rounded-3xl bg-gradient-to-br from-brand-600 to-teal-600 p-10 text-white shadow-xl lg:flex">
          <div>
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur"><GraduationCap className="h-8 w-8" /></div>
            <h1 className="text-3xl font-bold leading-tight">Attendance Manager for Schools</h1>
            <p className="mt-3 text-white/80">Track student attendance, manage holidays, and generate professional PDF reports — online or fully offline.</p>
          </div>
          <div className="space-y-3 text-sm text-white/85">
            <Feature icon={Cloud} text="Online mode syncs your data to the cloud per account" />
            <Feature icon={Database} text="Offline mode stores everything on this device only" />
            <Feature icon={ShieldCheck} text="Access Manager protects every online profile" />
          </div>
        </div>

        <div className="card flex flex-col gap-5 p-8 animate-slide-up">
          <div className="lg:hidden">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-teal-500 text-white"><GraduationCap className="h-7 w-7" /></div>
            <h1 className="text-xl font-bold">Attendance Manager for Schools</h1>
          </div>

          {!isFirebaseConfigured && <Notice text="Firebase isn't configured yet. You can still work offline." />}

          {showAccessGate ? (
            <AccessGate
              user={user}
              access={access}
              loading={loading}
              onRequest={handleRequest}
              onCheck={() => run(checkAgain)}
              onVerify={handleVerification}
              onSignOut={() => run(signOut)}
            />
          ) : (
            <>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{formMode === 'login' ? 'Sign in to sync' : 'Create an account'}</h2>
                {formMode === 'signup' && <Input id="displayName" label="Display name" autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" disabled={loading} />}
                <Input id="email" label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teacher@school.edu" disabled={!isFirebaseConfigured || loading} />
                <Input id="password" label="Password" type="password" autoComplete={formMode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" disabled={!isFirebaseConfigured || loading} />
                <Button type="submit" disabled={!isFirebaseConfigured} loading={loading}>
                  {!loading && (formMode === 'login' ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />)}
                  {formMode === 'login' ? 'Sign in' : 'Create account'}
                </Button>
                <Button variant="secondary" disabled={!isFirebaseConfigured || loading} onClick={() => run(signInWithGoogle)}>Continue with Google</Button>
                {formMode === 'login' && <Button variant="ghost" disabled={loading} onClick={handleReset}>Forgot password?</Button>}
                <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                  {formMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                  <button type="button" className="font-semibold text-brand-600 hover:underline" onClick={() => setFormMode(formMode === 'login' ? 'signup' : 'login')}>{formMode === 'login' ? 'Sign up' : 'Sign in'}</button>
                </p>
              </form>

              <div className="relative my-1"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-800" /></div><div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-slate-400 dark:bg-slate-900">or</span></div></div>
              <Button variant="secondary" onClick={() => run(enterOffline)} disabled={loading}><WifiOff className="h-4 w-4" /> Work Offline</Button>
              <p className="rounded-lg bg-slate-50 p-3 text-center text-xs text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">The device-only profile remains separate. Authorized online profiles are also cached for temporary offline use and sync after permission is revalidated.</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function AccessGate({ user, access, loading, onRequest, onCheck, onVerify, onSignOut }) {
  const message = access.kind === 'pending' ? ACCESS_MESSAGES.pending
    : access.kind === 'rejected' ? ACCESS_MESSAGES.rejected
      : access.kind === 'inactive' ? ACCESS_MESSAGES.inactive
        : access.kind === 'offline-unavailable' ? ACCESS_MESSAGES.offlineUnavailable
          : access.kind === 'error' ? access.message || 'Access could not be checked.'
            : ACCESS_MESSAGES.denied
  const needsVerification = access.requireEmailVerification && !access.emailVerified
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Application access</h2>
      {access.kind === 'checking' ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500"><RefreshCw className="h-4 w-4 animate-spin" /> Checking access…</div>
      ) : (
        <>
          <Notice text={message} />
          <p className="text-sm text-slate-500">Signed in as <strong>{user.email}</strong></p>
          {access.kind === 'denied' && !needsVerification && <Button className="w-full" loading={loading} onClick={onRequest}><UserPlus className="h-4 w-4" /> Request Access</Button>}
          {access.kind === 'denied' && needsVerification && <Button className="w-full" loading={loading} onClick={onVerify}><Mail className="h-4 w-4" /> Send Verification Email</Button>}
          {['pending', 'rejected', 'inactive', 'denied', 'offline-unavailable', 'error'].includes(access.kind) && <Button variant="secondary" className="w-full" disabled={loading} onClick={onCheck}><RefreshCw className="h-4 w-4" /> Check Again</Button>}
          <Button variant="ghost" className="w-full" disabled={loading} onClick={onSignOut}>Sign Out</Button>
        </>
      )}
    </div>
  )
}

function Notice({ text }) {
  return <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300"><AlertCircle className="h-5 w-5 shrink-0" /><p>{text}</p></div>
}

function Feature({ icon: Icon, text }) {
  return <div className="flex items-center gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15"><Icon className="h-4 w-4" /></div><span>{text}</span></div>
}

function friendlyAuthError(error) {
  const code = error?.code || ''
  const messages = {
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/user-not-found': 'No account found with that email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/email-already-in-use': 'An account with that email already exists.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
    'auth/network-request-failed': 'Network error. Check your connection.',
  }
  return messages[code] || error?.message || 'Authentication failed.'
}
