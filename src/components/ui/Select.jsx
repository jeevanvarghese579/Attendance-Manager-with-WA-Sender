// Accessible labeled select field.

import { Field } from './Input'
import { ChevronDown } from 'lucide-react'

export default function Select({ label, id, hint, error, children, className = '', ...props }) {
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error}>
      <div className="relative">
        <select id={id} className={`input-base appearance-none pr-9 ${className}`} {...props}>
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    </Field>
  )
}
