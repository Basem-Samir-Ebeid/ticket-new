export default function StatusBadge({ status, label, className = '', size = 'md', showIcon = true }) {
  const map = {
    opened:  { label: 'Opened',   bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', icon: '○' },
    pending: { label: 'Pending',  bg: '#fef3c7', border: '#fcd34d', text: '#92400e', icon: '⏳' },
    solved:  { label: 'Solved',   bg: '#d1fae5', border: '#a7f3d0', text: '#065f46', icon: '✓' },
    accepted:{ label: 'Accepted', bg: '#d1fae5', border: '#a7f3d0', text: '#065f46', icon: '✓' },
    refused: { label: 'Refused',  bg: '#fee2e2', border: '#fecaca', text: '#991b1b', icon: '✗' },
    approved:{ label: 'Approved', bg: '#d1fae5', border: '#a7f3d0', text: '#065f46', icon: '✓' },
    rejected:{ label: 'Rejected', bg: '#fee2e2', border: '#fecaca', text: '#991b1b', icon: '✗' },
    present: { label: 'Present',  bg: '#d1fae5', border: '#a7f3d0', text: '#065f46', icon: '✓' },
    absent:  { label: 'Absent',   bg: '#fee2e2', border: '#fecaca', text: '#991b1b', icon: '✗' },
    'in-progress': { label: 'In Progress', bg: '#dbeafe', border: '#93c5fd', text: '#0c4a6e', icon: '→' },
    completed: { label: 'Completed', bg: '#d1fae5', border: '#a7f3d0', text: '#065f46', icon: '✓' },
    draft: { label: 'Draft', bg: '#f3f4f6', border: '#d1d5db', text: '#374151', icon: '📝' },
  }
  const s = map[status] || { label: label || status, bg: '#f3f4f6', border: '#d1d5db', text: '#475569', icon: '?' }
  
  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${sizes[size]} ${className}`}
      style={{ background: s.bg, borderColor: s.border, color: s.text }}
    >
      {showIcon && <span className="text-xs">{s.icon}</span>}
      {s.label}
    </span>
  )
}
