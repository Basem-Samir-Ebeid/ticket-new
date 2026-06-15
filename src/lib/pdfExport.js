import jsPDF from 'jspdf'

const BRAND_COLOR = [99, 102, 241]
const DARK_BG = [10, 10, 20]
const TEXT_COLOR = [241, 245, 249]
const MUTED_COLOR = [100, 116, 139]

function addHeader(doc, title, subtitle) {
  const pageW = doc.internal.pageSize.getWidth()

  doc.setFillColor(...DARK_BG)
  doc.rect(0, 0, pageW, 30, 'F')

  doc.setFillColor(...BRAND_COLOR)
  doc.rect(0, 0, 4, 30, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Finest IT Management', 14, 12)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...MUTED_COLOR)
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, 14, 22)

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BRAND_COLOR)
  doc.text(title, pageW / 2, 44, { align: 'center' })

  if (subtitle) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...MUTED_COLOR)
    doc.text(subtitle, pageW / 2, 52, { align: 'center' })
  }

  return 60
}

function addTableHeader(doc, headers, y, colWidths, startX = 14) {
  doc.setFillColor(30, 32, 55)
  doc.roundedRect(startX - 2, y - 5, colWidths.reduce((a, b) => a + b, 0) + 4, 10, 2, 2, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...TEXT_COLOR)
  let x = startX
  headers.forEach((h, i) => {
    doc.text(h, x, y, { maxWidth: colWidths[i] - 4 })
    x += colWidths[i]
  })
  return y + 10
}

function addTableRow(doc, values, y, colWidths, startX = 14, isEven = false) {
  if (isEven) {
    doc.setFillColor(15, 17, 30)
    doc.rect(startX - 2, y - 5, colWidths.reduce((a, b) => a + b, 0) + 4, 9, 'F')
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...TEXT_COLOR)
  let x = startX
  values.forEach((val, i) => {
    const text = val === null || val === undefined ? '—' : String(val)
    doc.text(text, x, y, { maxWidth: colWidths[i] - 4 })
    x += colWidths[i]
  })
  return y + 9
}

function addPageNumbers(doc) {
  const pageCount = doc.getNumberOfPages()
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFillColor(15, 17, 30)
    doc.rect(0, pageH - 12, pageW, 12, 'F')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...MUTED_COLOR)
    doc.text(`Page ${i} of ${pageCount} — Finest IT Management System`, pageW / 2, pageH - 4, { align: 'center' })
  }
}

export function exportTicketsPDF(tickets, filters = {}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  doc.setFillColor(...DARK_BG)
  doc.rect(0, 0, 297, 210, 'F')

  const subtitle = filters.status ? `Status: ${filters.status}` : 'All Tickets'
  let y = addHeader(doc, 'Tickets Report', subtitle)

  const colWidths = [12, 80, 28, 22, 22, 40, 35, 30]
  const headers = ['#', 'Title', 'Category', 'Priority', 'Status', 'Assigned To', 'Created', 'SLA']
  y = addTableHeader(doc, headers, y, colWidths)

  const PRIORITY_MAP = { urgent: '🔴 Urgent', high: '🟠 High', medium: '🟡 Medium', low: '🟢 Low' }
  const STATUS_MAP = { opened: 'Opened', pending: 'Pending', solved: 'Solved' }

  tickets.forEach((t, idx) => {
    if (y > 185) {
      doc.addPage()
      doc.setFillColor(...DARK_BG)
      doc.rect(0, 0, 297, 210, 'F')
      y = 20
      y = addTableHeader(doc, headers, y, colWidths)
    }
    y = addTableRow(doc, [
      idx + 1,
      t.title?.slice(0, 45) || '—',
      t.category || '—',
      PRIORITY_MAP[t.priority] || t.priority,
      STATUS_MAP[t.status] || t.status,
      t.assignee_name || t.assigned_to_name || '—',
      t.created_at ? new Date(t.created_at).toLocaleDateString('en-GB') : '—',
      t.sla_deadline ? (new Date(t.sla_deadline) < new Date() ? '⚠ Breached' : '✓ OK') : '—',
    ], y, colWidths, 14, idx % 2 === 0)
  })

  addPageNumbers(doc)
  doc.save(`tickets-report-${new Date().toISOString().slice(0, 10)}.pdf`)
}

export function exportAttendancePDF(records, month, year) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  doc.setFillColor(...DARK_BG)
  doc.rect(0, 0, 297, 210, 'F')

  const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
  let y = addHeader(doc, 'Attendance Report', monthName)

  const colWidths = [55, 28, 28, 28, 28, 28, 28, 40]
  const headers = ['Employee', 'Days Present', 'Days Absent', 'Late Days', 'Early Departures', 'Overtime Hrs', 'Avg Hours/Day', 'Attendance Rate']
  y = addTableHeader(doc, headers, y, colWidths)

  records.forEach((r, idx) => {
    if (y > 185) {
      doc.addPage()
      doc.setFillColor(...DARK_BG)
      doc.rect(0, 0, 297, 210, 'F')
      y = 20
      y = addTableHeader(doc, headers, y, colWidths)
    }
    const rate = r.total_days ? `${Math.round((r.present_days / r.total_days) * 100)}%` : '—'
    y = addTableRow(doc, [
      r.full_name || r.employee_name || '—',
      r.present_days ?? '—',
      r.absent_days ?? '—',
      r.late_days ?? '—',
      r.early_departures ?? '—',
      r.overtime_hours ? `${r.overtime_hours}h` : '—',
      r.avg_hours ? `${r.avg_hours}h` : '—',
      rate,
    ], y, colWidths, 14, idx % 2 === 0)
  })

  addPageNumbers(doc)
  doc.save(`attendance-${year}-${String(month).padStart(2, '0')}.pdf`)
}

export function exportLeavesPDF(leaves) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  doc.setFillColor(...DARK_BG)
  doc.rect(0, 0, 210, 297, 'F')

  let y = addHeader(doc, 'Leave Requests Report', `Generated ${new Date().toLocaleDateString('en-GB')}`)

  const colWidths = [50, 28, 28, 22, 28, 32]
  const headers = ['Employee', 'Type', 'From', 'Days', 'Status', 'Reason']
  y = addTableHeader(doc, headers, y, colWidths, 10)

  const TYPE_MAP = { annual: 'Annual', sick: 'Sick', emergency: 'Emergency' }
  const STATUS_MAP = { pending: '⏳ Pending', approved: '✅ Approved', rejected: '❌ Rejected' }

  leaves.forEach((l, idx) => {
    if (y > 270) {
      doc.addPage()
      doc.setFillColor(...DARK_BG)
      doc.rect(0, 0, 210, 297, 'F')
      y = 20
      y = addTableHeader(doc, headers, y, colWidths, 10)
    }
    y = addTableRow(doc, [
      l.full_name || l.employee_name || '—',
      TYPE_MAP[l.leave_type] || l.leave_type,
      l.start_date ? new Date(l.start_date).toLocaleDateString('en-GB') : '—',
      l.days_count ?? '—',
      STATUS_MAP[l.status] || l.status,
      (l.reason || '—').slice(0, 30),
    ], y, colWidths, 10, idx % 2 === 0)
  })

  addPageNumbers(doc)
  doc.save(`leaves-report-${new Date().toISOString().slice(0, 10)}.pdf`)
}

export function exportUsersPDF(users) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  doc.setFillColor(...DARK_BG)
  doc.rect(0, 0, 297, 210, 'F')

  let y = addHeader(doc, 'Staff Directory', `Total: ${users.length} employees`)

  const colWidths = [60, 55, 35, 30, 30, 35, 32]
  const headers = ['Full Name', 'Email', 'Department', 'Job Title', 'Role', 'Phone', 'Hire Date']
  y = addTableHeader(doc, headers, y, colWidths)

  users.forEach((u, idx) => {
    if (y > 185) {
      doc.addPage()
      doc.setFillColor(...DARK_BG)
      doc.rect(0, 0, 297, 210, 'F')
      y = 20
      y = addTableHeader(doc, headers, y, colWidths)
    }
    y = addTableRow(doc, [
      u.full_name || '—',
      u.email || '—',
      u.department || '—',
      u.job_title || '—',
      u.role || '—',
      u.phone || '—',
      u.hire_date ? new Date(u.hire_date).toLocaleDateString('en-GB') : '—',
    ], y, colWidths, 14, idx % 2 === 0)
  })

  addPageNumbers(doc)
  doc.save(`staff-directory-${new Date().toISOString().slice(0, 10)}.pdf`)
}
