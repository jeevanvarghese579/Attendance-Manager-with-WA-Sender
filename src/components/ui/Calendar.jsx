// Shared month calendar used by Holiday Manager and Attendance Report.
// Renders a grid of days with per-day visual states. Selection is handled by
// the parent through the `renderDay` callback (returns styling/aria) and
// `onToggleDate`.

import { daysInMonth, fromDateKey, toDateKey } from '@/utils/date'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export default function Calendar({
  year, month,
  // renderDay(dateKey) => { className, label, ariaLabel, badge, disabled }
  renderDay,
  onToggleDate,
}) {
  const firstDow = new Date(year, month, 1).getDay()
  const total = daysInMonth(year, month)
  const today = toDateKey(new Date())

  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= total; d++) {
    cells.push(toDateKey(new Date(year, month, d)))
  }

  return (
    <div className="select-none">
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`text-center text-xs font-medium ${
              i === 0 ? 'text-rose-500' : i === 6 ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'
            }`}
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((key, i) => {
          if (!key) return <div key={`b${i}`} />
          const day = fromDateKey(key).getDate()
          const meta = renderDay?.(key) || {}
          const isToday = key === today
          return (
            <button
              key={key}
              type="button"
              onClick={() => !meta.disabled && onToggleDate?.(key)}
              disabled={meta.disabled}
              aria-label={meta.ariaLabel || `${day}`}
              title={meta.title}
              className={[
                'relative flex h-12 items-center justify-center rounded-lg border text-sm transition',
                meta.className || 'border-slate-200 bg-white hover:border-brand-400 dark:border-slate-700 dark:bg-slate-800',
                meta.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                isToday ? 'ring-2 ring-brand-500 ring-offset-1 dark:ring-offset-slate-900' : '',
              ].join(' ')}
            >
              <span>{day}</span>
              {meta.badge && (
                <span className={meta.badgeClassName || 'absolute bottom-1 right-1 text-[10px] font-bold'}>
                  {meta.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
