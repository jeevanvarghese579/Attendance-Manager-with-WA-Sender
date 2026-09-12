// Professional full-class attendance PDF generator.
// A4 portrait, students sorted by roll number, 5 month-boxes per row, dynamic
// box height to fit all absent dates, no box split across pages, smart student
// pagination that uses remaining page space.

import { jsPDF } from 'jspdf'
import { eachMonthInRange, fromDateKey, formatShortDate, monthName } from '@/utils/date'
import { monthStats } from '@/utils/attendance'
import { sortByRollNumber } from '@/utils/sort'

const PAGE = { w: 595.28, h: 841.89 } // A4 portrait in points
const MARGIN = 40
const CONTENT_W = PAGE.w - MARGIN * 2
const BOX_W = (CONTENT_W - 8 * 2) / 5 // 5 boxes per row, 8pt gap
const GAP = 8
const BOXES_PER_ROW = 5

export function generateClassPdf({ className, academicYear, students, effectiveHolidays, academicStart, academicEnd }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
  // Force portrait and verify.
  doc.internal.pageSize.width = PAGE.w
  doc.internal.pageSize.height = PAGE.h

  const months = academicStart && academicEnd ? eachMonthInRange(academicStart, academicEnd) : []
  const sortedStudents = sortByRollNumber(students)
  const genDate = new Date().toLocaleDateString()

  let y = MARGIN

  const drawHeader = () => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('Attendance Report', MARGIN, y)
    y += 18
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`Class: ${className || '-'}`, MARGIN, y)
    y += 14
    doc.text(`Academic Year: ${academicYear || '-'}`, MARGIN, y)
    y += 14
    doc.text(`Generated: ${genDate}`, MARGIN, y)
    y += 20
  }

  const drawPageNumber = (pageNum) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text(`Page ${pageNum}`, PAGE.w - MARGIN, PAGE.h - 20, { align: 'right' })
    doc.setTextColor(0)
  }

  drawHeader()
  let pageNum = 1
  drawPageNumber(pageNum)

  // Minimum space required to start a student: heading + one full row of boxes.
  const minSpaceForStudent = 40 + 70

  for (let si = 0; si < sortedStudents.length; si++) {
    const student = sortedStudents[si]
    const absenceSet = new Set(
      // attendance filtered by student handled by caller via effectiveHolidays
      student._absenceKeys || []
    )

    if (y + minSpaceForStudent > PAGE.h - MARGIN - 30) {
      doc.addPage()
      y = MARGIN
      drawHeader()
      pageNum++
      drawPageNumber(pageNum)
    }

    // Student heading
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(`${student.name}`, MARGIN, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`Roll No: ${student.rollNumber}`, MARGIN + 200, y)
    const joinedDate = student.attendanceStartDate || academicStart
    if (joinedDate) doc.text(`Joined: ${formatShortDate(joinedDate)}`, PAGE.w - MARGIN, y, { align: 'right' })
    y += 8
    doc.setDrawColor(200)
    doc.line(MARGIN, y, PAGE.w - MARGIN, y)
    y += 12

    // Build month box data
    const boxes = months.map(({ year, month }) => {
      const st = monthStats({
        year,
        month,
        academicStart,
        academicEnd,
        attendanceStartDate: student.attendanceStartDate || academicStart,
        effectiveHolidays,
        absenceSet,
      })
      const dayNums = st.absentDates.map(k => String(fromDateKey(k).getDate()))
      const absentDateLines = dayNums.length
        ? doc.splitTextToSize(dayNums.join(', '), BOX_W - 10)
        : ['None']
      return { year, month, st, dayNums, absentDateLines }
    })

    // Render boxes in rows of 5, with dynamic height per row.
    let i = 0
    while (i < boxes.length) {
      const row = boxes.slice(i, i + BOXES_PER_ROW)
      // Compute row height = tallest box.
      let rowH = 0
      for (const b of row) {
        const h = monthBoxHeight(b)
        if (h > rowH) rowH = h
      }

      // If row won't fit, move whole row to next page.
      if (y + rowH > PAGE.h - MARGIN - 20) {
        doc.addPage()
        y = MARGIN
        drawHeader()
        pageNum++
        drawPageNumber(pageNum)
      }

      let x = MARGIN
      for (const b of row) {
        drawMonthBox(doc, x, y, BOX_W, rowH, b)
        x += BOX_W + GAP
      }
      y += rowH + 12
      i += BOXES_PER_ROW
    }

    y += 14
  }

  doc.save(`attendance-report-${(className || 'class').replace(/\s+/g, '-').toLowerCase()}.pdf`)
}

function drawMonthBox(doc, x, y, w, h, b) {
  const { st, dayNums, absentDateLines, month, year } = b
  doc.setDrawColor(180)
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(x, y, w, h, 4, 4, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(15, 118, 110)
  doc.text(monthName(month).slice(0, 4), x + 5, y + 12)
  doc.setTextColor(0)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text(String(year), x + w - 5, y + 12, { align: 'right' })

  if (st.notEnrolled) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(100)
    doc.text('Not Enrolled', x + w / 2, y + h / 2, { align: 'center' })
    doc.setTextColor(0)
    doc.setFont('helvetica', 'normal')
    return
  }

  let ty = y + 22
  doc.setFontSize(7)
  doc.text('Absent Dates:', x + 5, ty)
  ty += 9
  if (dayNums.length === 0) {
    doc.setTextColor(120)
    doc.text('None', x + 5, ty)
    doc.setTextColor(0)
  } else {
    doc.text(absentDateLines, x + 5, ty)
  }
  ty += absentDateLines.length * 9

  // Footer stats — pinned to box bottom.
  const fy = ty + 5
  doc.setDrawColor(220)
  doc.line(x + 4, fy, x + w - 4, fy)
  doc.setFontSize(5.5)
  doc.text(`Present This Month: ${st.presentThisMonth}`, x + 5, fy + 9)
  doc.text(`Working Days This Month: ${st.workingDaysMonth}`, x + 5, fy + 18)
  doc.text(`Present Up to This Month: ${st.presentUpToThisMonth}`, x + 5, fy + 27)
  doc.text(`Working Days Up to This Month: ${st.cumWorkingDays}`, x + 5, fy + 36)
  doc.text(`Absents This Month: ${st.absencesMonth}`, x + 5, fy + 45)
  doc.text(`Total Leaves: ${st.cumLeaves}`, x + 5, fy + 54)
  const pct = st.attendancePct === null ? 'N/A' : `${st.attendancePct.toFixed(2)}%`
  doc.setFont('helvetica', 'bold')
  doc.text(`Attendance Percentage: ${pct}`, x + 5, fy + 63)
  doc.setFont('helvetica', 'normal')
}

function monthBoxHeight(box) {
  if (box.st.notEnrolled) return 52
  // Header and absent-date content + small gap + seven statistic lines + padding.
  return 31 + box.absentDateLines.length * 9 + 5 + 63 + 5
}
