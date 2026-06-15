import { useState } from 'react'

const MONTH_NAMES = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
const DAY_NAMES_SHORT = ['ح','ن','ث','ر','خ','ج','س']

const TYPE_COLORS = {
  annual:    { bg: 'rgba(99,102,241,0.25)', border: 'rgba(99,102,241,0.5)', text: '#a5b4fc', dot: '#6366f1' },
  sick:      { bg: 'rgba(239,68,68,0.2)',   border: 'rgba(239,68,68,0.4)',  text: '#fca5a5', dot: '#ef4444' },
  emergency: { bg: 'rgba(245,158,11,0.2)',  border: 'rgba(245,158,11,0.4)', text: '#fde68a', dot: '#f59e0b' },
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay()
}

function dateRangeIntersects(startA, endA, startB, endB) {
  return startA <= endB && endA >= startB
}

function parseDate(str) {
  if (!str) return null
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toYMD(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

export default function LeaveCalendar({ leaves = [], users = [] }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selectedDay, setSelectedDay] = useState(null)

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  const userMap = {}
  users.forEach(u => { userMap[u.id] = u.full_name || u.email })

  const approvedLeaves = leaves.filter(l => l.status === 'approved')

  function getLeavesForDay(dayNum) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`
    const d = new Date(year, month, dayNum)
    return approvedLeaves.filter(l => {
      const start = parseDate(l.start_date)
      const end = parseDate(l.end_date)
      if (!start || !end) return false
      return d >= start && d <= end
    })
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setSelectedDay(null)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setSelectedDay(null)
  }

  const today = new Date()
  const isToday = (d) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === d

  const selectedLeaves = selectedDay ? getLeavesForDay(selectedDay) : []

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="animate-fadeIn" style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 340px', minWidth: 280 }}>
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16, overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px',
            background: 'rgba(99,102,241,0.06)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <button onClick={prevMonth} className="btn-ghost" style={{ padding: '6px 10px' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 15 }}>
              {MONTH_NAMES[month]} {year}
            </span>
            <button onClick={nextMonth} className="btn-ghost" style={{ padding: '6px 10px' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div style={{ padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
              {DAY_NAMES_SHORT.map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#475569', padding: '4px 0' }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {cells.map((day, i) => {
                if (!day) return <div key={i} />
                const dayLeaves = getLeavesForDay(day)
                const isSelected = selectedDay === day
                const isTod = isToday(day)
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    style={{
                      position: 'relative',
                      height: 38,
                      borderRadius: 8,
                      border: isSelected ? '1px solid rgba(99,102,241,0.6)' : isTod ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                      background: isSelected ? 'rgba(99,102,241,0.15)' : isTod ? 'rgba(99,102,241,0.08)' : 'transparent',
                      color: isTod ? '#a5b4fc' : '#94a3b8',
                      fontWeight: isTod ? 700 : 400,
                      fontSize: 13,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 2,
                      transition: 'all 0.15s',
                    }}
                  >
                    {day}
                    {dayLeaves.length > 0 && (
                      <div style={{ display: 'flex', gap: 2 }}>
                        {dayLeaves.slice(0, 3).map((l, li) => {
                          const c = TYPE_COLORS[l.leave_type] || TYPE_COLORS.annual
                          return <div key={li} style={{ width: 4, height: 4, borderRadius: '50%', background: c.dot }} />
                        })}
                        {dayLeaves.length > 3 && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#475569' }} />}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 16 }}>
            {Object.entries(TYPE_COLORS).map(([type, c]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot }} />
                {type === 'annual' ? 'سنوي' : type === 'sick' ? 'مرضي' : 'طارئ'}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ flex: '1 1 280px', minWidth: 240 }}>
        {selectedDay ? (
          <div className="animate-fadeIn">
            <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>
              إجازات يوم {selectedDay} {MONTH_NAMES[month]}
            </p>
            {selectedLeaves.length === 0 ? (
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 12, padding: '24px 16px',
                textAlign: 'center', color: '#475569', fontSize: 13,
              }}>لا توجد إجازات هذا اليوم</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedLeaves.map((l, i) => {
                  const c = TYPE_COLORS[l.leave_type] || TYPE_COLORS.annual
                  return (
                    <div key={i} style={{
                      background: c.bg, border: `1px solid ${c.border}`,
                      borderRadius: 12, padding: '12px 14px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ color: c.text, fontSize: 13, fontWeight: 600 }}>
                          {userMap[l.user_id] || l.full_name || l.employee_name || 'موظف'}
                        </span>
                        <span style={{ color: c.dot, fontSize: 11, fontWeight: 600, background: 'rgba(0,0,0,0.2)', padding: '2px 8px', borderRadius: 20 }}>
                          {l.leave_type === 'annual' ? 'سنوي' : l.leave_type === 'sick' ? 'مرضي' : 'طارئ'}
                        </span>
                      </div>
                      <p style={{ color: '#64748b', fontSize: 12 }}>
                        {new Date(l.start_date).toLocaleDateString('ar-EG')} — {new Date(l.end_date).toLocaleDateString('ar-EG')}
                        <span style={{ marginLeft: 8 }}>({l.days_count} يوم)</span>
                      </p>
                      {l.reason && <p style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>{l.reason}</p>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12, padding: '24px 16px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📅</div>
            <p style={{ color: '#475569', fontSize: 13 }}>اختر يوماً لعرض الإجازات</p>
            <p style={{ color: '#334155', fontSize: 11, marginTop: 6 }}>
              {approvedLeaves.length} إجازة معتمدة هذا الشهر
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
