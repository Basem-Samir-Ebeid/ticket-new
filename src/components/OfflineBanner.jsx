import { useState, useEffect } from 'react'

export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)
  const [wasOffline, setWasOffline] = useState(false)
  const [showBack, setShowBack] = useState(false)

  useEffect(() => {
    function onOffline() {
      setOffline(true)
      setWasOffline(true)
      setShowBack(false)
    }
    function onOnline() {
      setOffline(false)
      if (wasOffline) {
        setShowBack(true)
        const t = setTimeout(() => setShowBack(false), 3500)
        return () => clearTimeout(t)
      }
    }
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [wasOffline])

  if (!offline && !showBack) return null

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2.5 px-4 py-2.5 rounded-2xl shadow-2xl text-sm font-medium animate-fadeIn"
      style={offline
        ? { background: 'rgba(239,68,68,0.92)', border: '1px solid rgba(239,68,68,0.4)', color: '#fff', backdropFilter: 'blur(12px)' }
        : { background: 'rgba(16,185,129,0.92)', border: '1px solid rgba(16,185,129,0.4)', color: '#fff', backdropFilter: 'blur(12px)' }}>
      {offline ? (
        <>
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728m-3.536-3.536a4.5 4.5 0 010-5.656M6.343 6.343a9 9 0 000 12.728m3.536-3.536a4.5 4.5 0 000-5.656M12 12h.01" />
          </svg>
          You're offline — changes will sync when reconnected
        </>
      ) : (
        <>
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
          </svg>
          Back online!
        </>
      )}
    </div>
  )
}
