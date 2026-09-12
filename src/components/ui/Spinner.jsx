// Loading spinner.

import { Loader2 } from 'lucide-react'

export default function Spinner({ size = 24, className = '' }) {
  return <Loader2 className={`animate-spin text-brand-500 ${className}`} style={{ width: size, height: size }} />
}

export function FullPageSpinner({ label = 'Loading…' }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-10">
      <Spinner size={32} />
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  )
}
