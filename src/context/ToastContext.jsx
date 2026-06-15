import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const ToastContext = createContext(null)

const ICONS = {
  success: (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  ),
  error: (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  warning: (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  info: (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  ),
}

const STYLES = {
  success: {
    bg: 'rgba(16,185,129,0.1)',
    border: 'rgba(16,185,129,0.25)',
    icon: '#10b981',
    bar: '#10b981',
  },
  error: {
    bg: 'rgba(239,68,68,0.1)',
    border: 'rgba(239,68,68,0.25)',
    icon: '#ef4444',
    bar: '#ef4444',
  },
  warning: {
    bg: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.25)',
    icon: '#f59e0b',
    bar: '#f59e0b',
  },
  info: {
    bg: 'rgba(99,102,241,0.1)',
    border: 'rgba(99,102,241,0.25)',
    icon: '#818cf8',
    bar: '#6366f1',
  },
}

function ToastItem({ toast, onRemove }) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const style = STYLES[toast.type] || STYLES.info

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  function dismiss() {
    setLeaving(true)
    setTimeout(() => onRemove(toast.id), 280)
  }

  return (
    <div
      onClick={dismiss}
      style={{
        background: 'rgba(10,10,20,0.97)',
        border: `1px solid ${style.border}`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${style.border}`,
        transition: 'all 0.28s cubic-bezier(0.16,1,0.3,1)',
        opacity: visible && !leaving ? 1 : 0,
        transform: visible && !leaving ? 'translateX(0) scale(1)' : 'translateX(40px) scale(0.96)',
        cursor: 'pointer',
        borderRadius: 14,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        minWidth: 280,
        maxWidth: 380,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ color: style.icon, marginTop: 1 }}>{ICONS[toast.type]}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {toast.title && (
          <p style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{toast.title}</p>
        )}
        <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.4 }}>{toast.message}</p>
      </div>
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0,
        height: 2,
        background: style.bar,
        borderRadius: '0 0 0 14px',
        animation: `toast-progress ${toast.duration}ms linear forwards`,
      }} />
    </div>
  )
}

function ToastContainer({ toasts, removeToast }) {
  if (toasts.length === 0) return null
  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      alignItems: 'flex-end',
    }}>
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onRemove={removeToast} />
      ))}
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((message, type = 'info', options = {}) => {
    const id = Date.now() + Math.random()
    const duration = options.duration || 4000
    const toast = { id, message, type, title: options.title, duration }
    setToasts(prev => [...prev.slice(-4), toast])
    setTimeout(() => removeToast(id), duration + 300)
    return id
  }, [removeToast])

  const toast = {
    success: (message, options) => addToast(message, 'success', typeof options === 'string' ? { title: options } : options || {}),
    error:   (message, options) => addToast(message, 'error',   typeof options === 'string' ? { title: options } : options || {}),
    warning: (message, options) => addToast(message, 'warning', typeof options === 'string' ? { title: options } : options || {}),
    info:    (message, options) => addToast(message, 'info',    typeof options === 'string' ? { title: options } : options || {}),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    return {
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
    }
  }
  return ctx
}
