import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import LogoWithStars from './LogoWithStars'
import { isMuted, toggleMute } from '../lib/sound'
import { api } from '../lib/api'

export default function Navbar({ title }) {
  const { profile, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [muted, setMuted] = useState(isMuted())
  const [notifications, setNotifications] = useState([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const dropdownRef = useRef(null)

  async function fetchNotifications() {
    try { setNotifications(await api.getNotifications()) } catch {}
  }

  async function markRead(id) {
    try {
      await api.markRead(id)
      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch {}
  }

  async function markAllRead() {
    setMarkingAll(true)
    try {
      await Promise.all(notifications.map(n => api.markRead(n.id)))
      setNotifications([])
    } catch {}
    setMarkingAll(false)
  }

  useEffect(() => {
    if (profile) fetchNotifications()
  }, [profile])

  useEffect(() => {
    const handler = (e) => setMuted(e.detail)
    window.addEventListener('sound:mute_changed', handler)
    return () => window.removeEventListener('sound:mute_changed', handler)
  }, [])

  useEffect(() => {
    const handler = () => fetchNotifications()
    window.addEventListener('ws:notification', handler)
    window.addEventListener('notif:refreshed', handler)
    return () => {
      window.removeEventListener('ws:notification', handler)
      window.removeEventListener('notif:refreshed', handler)
    }
  }, [])

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowNotifs(false)
      }
    }
    if (showNotifs) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showNotifs])

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
    setSigningOut(false)
  }

  const unreadCount = notifications.length

  return (
    <nav className="border-b border-white/8 px-6 py-4 flex items-center justify-between" style={{background:'rgba(10,10,15,0.8)', backdropFilter:'blur(12px)'}}>
      <div className="flex flex-col items-center">
        <LogoWithStars imgClassName="w-8 h-8 rounded-lg object-cover" />
        <span className="font-semibold text-white text-xs mt-0.5">{title}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {profile?.profile_picture_url ? (
            <img
              src={profile.profile_picture_url}
              alt={profile.full_name || 'User'}
              className="w-8 h-8 rounded-full object-cover border border-white/20 flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-600/40 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-blue-300 text-sm font-semibold">
                {(profile?.full_name || profile?.email || '?')[0].toUpperCase()}
              </span>
            </div>
          )}
          <div className="text-right hidden sm:block">
            <p className="text-sm text-white">{profile?.full_name || profile?.email}</p>
            <p className="text-xs text-slate-400 capitalize">{profile?.role}</p>
          </div>
        </div>

        {/* Bell notification button */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowNotifs(v => !v)}
            title="الإشعارات"
            className={`relative w-8 h-8 flex items-center justify-center rounded-lg border transition-colors ${
              unreadCount > 0
                ? 'bg-orange-500/20 border-orange-400/30 text-orange-300 hover:bg-orange-500/30'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center bg-orange-500 text-white text-[10px] font-bold rounded-full px-1 leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {showNotifs && (
            <div className="absolute right-0 top-10 w-80 z-50 rounded-xl border border-white/10 shadow-2xl overflow-hidden"
              style={{ background: 'rgba(12,12,20,0.97)', backdropFilter: 'blur(16px)' }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                <span className="text-white text-sm font-semibold">
                  الإشعارات {unreadCount > 0 && <span className="text-orange-400">({unreadCount})</span>}
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    disabled={markingAll}
                    className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors"
                  >
                    {markingAll ? '...' : 'قراءة الكل'}
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                    </svg>
                    <p className="text-slate-500 text-sm">لا توجد إشعارات جديدة</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors group">
                      <div className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0 mt-1.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-200 text-xs leading-relaxed">{n.message}</p>
                        {n.created_at && (
                          <p className="text-slate-600 text-[10px] mt-1">
                            {new Date(n.created_at).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => markRead(n.id)}
                        className="text-[10px] text-slate-600 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap flex-shrink-0 mt-0.5"
                      >
                        ✓ قراءة
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Mute toggle */}
        <button
          onClick={toggleMute}
          title={muted ? 'تفعيل صوت التنبيهات' : 'كتم صوت التنبيهات'}
          className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors ${
            muted
              ? 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/20'
              : 'bg-blue-600/15 border-blue-500/25 text-blue-400 hover:bg-blue-600/25'
          }`}
        >
          {muted ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
            </svg>
          )}
        </button>

        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="text-xs text-white bg-red-500/15 hover:bg-red-500/25 border border-red-400/30 hover:border-red-300/40 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors"
        >
          {signingOut ? 'Signing Out...' : 'Sign Out'}
        </button>
      </div>
    </nav>
  )
}
