// Startup page — login or work offline. No signup button.

import { useState } from 'react'
import { GraduationCap, LogIn, WifiOff, Loader2, ShieldCheck, Database, Cloud } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { isFirebaseConfigured } from '@/services/firebase/config'

export default function StartPage() {
  const { enterOnline, enterOffline } = useAuth()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      toast.error('Enter your email and password.')
      return
    }
    setLoading(true)
    try {
      await enterOnline(email.trim(), password)
      toast.success('Signed in. Loading your data…')
    } catch (err) {
      toast.error(friendlyAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-brand-50/40 to-teal-50/30 p-4 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* Brand panel */}
        <div className="hidden flex-col justify-between rounded-3xl bg-gradient-to-br from-brand-600 to-teal-600 p-10 text-white shadow-xl lg:flex">
          <div>
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
              <GraduationCap className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-bold leading-tight">Attendance Manager for Schools</h1>
            <p className="mt-3 text-white/80">
              Track student attendance, manage holidays, and generate professional PDF reports —
              online or fully offline.
            </p>
          </div>
          <div className="space-y-3 text-sm text-white/85">
            <Feature icon={Cloud} text="Online mode syncs your data to the cloud per account" />
            <Feature icon={Database} text="Offline mode stores everything on this device only" />
            <Feature icon={ShieldCheck} text="Each account sees only its own data — never mixed" />
          </div>
        </div>

        {/* Choice panel */}
        <div className="card flex flex-col gap-5 p-8 animate-slide-up">
          <div className="lg:hidden">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-teal-500 text-white">
              <GraduationCap className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-bold">Attendance Manager for Schools</h1>
          </div>

          {!isFirebaseConfigured && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
              Firebase isn't configured yet. You can still work offline. Add Firebase credentials to <code>.env</code> to enable online login.
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Sign in to sync</h2>
            <Input
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teacher@school.edu"
              disabled={!isFirebaseConfigured || loading}
            />
            <Input
              id="password"
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={!isFirebaseConfigured || loading}
            />
            <Button type="submit" disabled={!isFirebaseConfigured} loading={loading}>
              {!loading && <LogIn className="h-4 w-4" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <div className="relative my-1">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-800" /></div>
            <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-slate-400 dark:bg-slate-900">or</span></div>
          </div>

          <Button variant="secondary" onClick={enterOffline} disabled={loading}>
            <WifiOff className="h-4 w-4" /> Work Offline
          </Button>

          <p className="rounded-lg bg-slate-50 p-3 text-center text-xs text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
            Online and offline data are stored separately. Use Master Backup and Restore in Settings to move data between profiles.
          </p>
        </div>
      </div>
    </div>
  )
}

function Feature({ icon: Icon, text }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
        <Icon className="h-4 w-4" />
      </div>
      <span>{text}</span>
    </div>
  )
}

function friendlyAuthError(err) {
  const code = err?.code || ''
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found'))
    return 'Incorrect email or password.'
  if (code.includes('too-many-requests')) return 'Too many attempts. Try again later.'
  if (code.includes('network')) return 'Network error. Check your connection.'
  return err?.message || 'Could not sign in.'
}
