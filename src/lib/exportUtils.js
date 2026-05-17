import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export function exportToExcel(filename, sheets) {
  const wb = XLSX.utils.book_new()
  for (const { name, rows } of sheets) {
    if (!rows || rows.length === 0) continue
    const ws = XLSX.utils.json_to_sheet(rows)
    // Auto-fit column widths
    const colWidths = {}
    for (const row of rows) {
      for (const [key, val] of Object.entries(row)) {
        colWidths[key] = Math.max(colWidths[key] || key.length, String(val ?? '').length)
      }
    }
    ws['!cols'] = Object.values(colWidths).map(w => ({ wch: Math.min(w + 2, 50) }))
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31))
  }
  XLSX.writeFile(wb, filename)
}

export function exportTicketsToExcel(tickets, filename = 'tickets-export.xlsx') {
  const rows = tickets.map(t => ({
    'ID': t.id?.slice(0, 8),
    'Title': t.title,
    'Category': t.category || '',
    'Priority': t.priority,
    'Status': t.status,
    'Assigned To': t.assigned_to_name || '',
    'Created By': t.created_by_name || '',
    'Created Date': t.created_at ? new Date(t.created_at).toLocaleDateString() : '',
    'Solved Date': t.solved_at ? new Date(t.solved_at).toLocaleDateString() : '',
    'Resolution Time (hrs)': t.solved_at && t.created_at
      ? Math.round((new Date(t.solved_at) - new Date(t.created_at)) / 3600000)
      : '',
    'Rating': t.rating || '',
    'Tags': (t.tags || []).join(', '),
  }))
  exportToExcel(filename, [{ name: 'Tickets', rows }])
}

export function exportAttendanceToExcel(records, filename = 'attendance-export.xlsx') {
  const rows = records.map(r => {
    const loginTime = r.login_time ? new Date(r.login_time) : null
    const logoutTime = r.logout_time ? new Date(r.logout_time) : null
    const hours = loginTime && logoutTime
      ? Math.round((logoutTime - loginTime) / 360000) / 10
      : ''
    return {
      'Employee': r.full_name || r.email || '',
      'Date': r.date || '',
      'Login Time': loginTime ? loginTime.toLocaleTimeString() : '',
      'Logout Time': logoutTime ? logoutTime.toLocaleTimeString() : '',
      'Hours Worked': hours,
      'Type': r.attendance_type || 'office',
    }
  })
  exportToExcel(filename, [{ name: 'Attendance', rows }])
}

export function exportAssetsToExcel(assets, filename = 'assets-export.xlsx') {
  const rows = assets.map(a => ({
    'Name': a.name,
    'Type': a.type,
    'Brand': a.brand || '',
    'Model': a.model || '',
    'Serial Number': a.serial_number || '',
    'Status': a.status,
    'Condition': a.condition,
    'Assigned To': a.assigned_to_name || '',
    'Location': a.location || '',
    'Purchase Date': a.purchase_date || '',
    'Warranty Expires': a.warranty_expires || '',
    'Purchase Price': a.purchase_price || '',
  }))
  exportToExcel(filename, [{ name: 'Assets', rows }])
}

export function exportPenaltiesToExcel(penalties, filename = 'penalties-export.xlsx') {
  const rows = penalties.map(p => ({
    'Employee': p.user_name || '',
    'Type': p.type,
    'Reason': p.reason,
    'Amount': p.amount || '',
    'Notes': p.notes || '',
    'Issued By': p.issued_by_name || '',
    'Date': p.created_at ? new Date(p.created_at).toLocaleDateString() : '',
  }))
  exportToExcel(filename, [{ name: 'Penalties', rows }])
}

export async function exportElementToPdf(element, filename = 'report.pdf') {
  if (!element) return
  const canvas = await html2canvas(element, {
    backgroundColor: '#05050a',
    scale: 1.5,
    useCORS: true,
    logging: false,
  })
  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width
  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
  pdf.save(filename)
}
