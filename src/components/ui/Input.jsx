// Accessible labeled input field.

export function Field({ label, htmlFor, children, hint, error }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      {children}
      {error
        ? <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
        : hint && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  )
}

export default function Input({ label, id, hint, error, ...props }) {
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error}>
      <input id={id} className="input-base" {...props} />
    </Field>
  )
}
