// Build a WhatsApp share URL with the absentee message.

import { sortByRollNumber } from './sort'
import { formatShortDate } from './date'

export function buildAbsenteeMessage({ className, students, dateKey }) {
  const sorted = sortByRollNumber(students)
  const lines = [
    `Today's Absentees (${formatShortDate(dateKey)})`,
    `Class: ${className || '(no class)'}`,
    '',
  ]
  if (sorted.length === 0) {
    lines.push('No absentees today.')
  } else {
    sorted.forEach((s, i) => {
      lines.push(`${i + 1}. ${s.name} (Roll No: ${s.rollNumber})`)
    })
  }
  return lines.join('\n')
}

export function whatsappUrl(message) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}
