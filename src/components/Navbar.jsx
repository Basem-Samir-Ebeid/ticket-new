import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import LogoWithStars from './LogoWithStars'
import { isMuted, toggleMute } from '../lib/sound'
import { api } from '../lib/api'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })
}

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
    <nav className="border-b border-white/8 px-4 sm:px-6 py-3.5 flex items-center justify-between sticky top-0 z-40" style={{background:'rgba(10,10,15,0.9)', backdropFilter:'blur(20px)'}}>
      <div className="flex items-center gap-3">
        <LogoWithStars imgClassName="w-8 h-8 rounded-lg object-cover" />
        <span className="font-semibold text-white text-sm tracking-tight">{title}</span>
      </div>

      <div className="flex items-center gap-2">
        {/* Profile */}
        <div className="flex items-center gap-2.5 mr-1">
          {profile?.profile_picture_url ? (
            <img
              src={profile.profile_picture_url}
              alt={profile.full_name || 'User'}
              className="w-8 h-8 rounded-full object-cover border border-white/15 flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold border border-white/10"
              style={{background:'linear-gradient(135deg, #4f46e5, #7c3aed)'}}>
              {(profile?.full_name || profile?.email || '?')[0].toUpperCase()}
            </div>
          )}
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-white leading-tight">{profile?.full_name || profile?.email}</p>
            <p className="text-[11px] text-slate-500 capitalize">{profile?.role?.replace('_', ' ')}</p>
          </div>
        </div>

        {/* Bell notification button */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowNotifs(v => !v)}
            title="الإشعارات"
            className={`relative w-9 h-9 flex items-center justify-center rounded-xl border transition-all ${
              unreadCount > 0
                ? 'border-orange-400/30 text-orange-300 hover:border-orange-400/50'
                : 'border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20'
            } ${showNotifs ? 'bg-white/10' : 'bg-white/5 hover:bg-white/8'}`}
            style={unreadCount > 0 ? {background: 'rgba(251,146,60,0.12)'} : {}}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-orange-500 text-white text-[10px] font-bold rounded-full px-1 leading-none shadow-lg">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {showNotifs && (
            <div
              className="absolute right-0 top-11 w-96 z-50 rounded-2xl shadow-2xl overflow-hidden animate-scaleIn"
              style={{
                background: 'rgba(10,12,24,0.97)',
                backdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.08)',
                transformOrigin: 'top right',
              }}
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-white/8" style={{background:'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(124,58,237,0.05) 100%)'}}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:'rgba(251,146,60,0.15)', border:'1px solid rgba(251,146,60,0.2)'}}>
                      <svg className="w-3.5 h-3.5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold leading-tight">الإشعارات</p>
                      {unreadCount > 0 && (
                        <p className="text-orange-400 text-[11px] leading-tight">{unreadCount} غير مقروء</p>
                      )}
                    </div>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      disabled={markingAll}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white disabled:opacity-50 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/8 border border-transparent hover:border-white/10"
                    >
                      {markingAll ? (
                        <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                      ) : (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                      قراءة الكل
                    </button>
                  )}
                </div>
              </div>

              {/* List */}
              <div className="max-h-80 overflow-y-auto" style={{scrollbarWidth:'thin', scrollbarColor:'rgba(255,255,255,0.1) transparent'}}>
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)'}}>
                      <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-400 text-sm font-medium">لا توجد إشعارات</p>
                      <p className="text-slate-600 text-xs mt-1">سيظهر هنا كل جديد</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {notifications.map((n, i) => (
                      <div
                        key={n.id}
                        className="flex items-start gap-3 px-3 py-3 rounded-xl hover:bg-white/5 transition-all group cursor-default"
                        style={{animationDelay: `${i * 0.04}s`}}
                      >
                        <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mt-0.5" style={{background:'rgba(251,146,60,0.12)', border:'1px solid rgba(251,146,60,0.15)'}}>
                          <svg className="w-3.5 h-3.5 text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-200 text-xs leading-relaxed">{n.message}</p>
                          {n.created_at && (
                            <p className="text-slate-600 text-[10px] mt-1 flex items-center gap-1">
                              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {timeAgo(n.created_at)}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => markRead(n.id)}
                          className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center text-slate-600 hover:text-green-400 hover:bg-green-400/10 opacity-0 group-hover:opacity-100 transition-all"
                          title="تحديد كمقروء"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              {unreadCount > 0 && (
                <div className="px-5 py-3 border-t border-white/5" style={{background:'rgba(255,255,255,0.02)'}}>
                  <p className="text-slate-600 text-[11px] text-center">انقر ✓ على أي إشعار لتحديده كمقروء</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mute toggle */}
        <button
          onClick={toggleMute}
          title={muted ? 'تفعيل صوت التنبيهات' : 'كتم صوت التنبيهات'}
          className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all ${
            muted
              ? 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/20'
              : 'border-blue-500/20 text-blue-400 hover:border-blue-500/30 hover:bg-blue-500/10'
          }`}
          style={!muted ? {background:'rgba(59,130,246,0.08)'} : {}}
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

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex items-center gap-1.5 text-xs font-medium text-white disabled:opacity-60 px-3 py-2 rounded-xl transition-all border border-red-500/20 hover:border-red-400/30"
          style={{background:'rgba(239,68,68,0.08)'}}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
        >
          {signingOut ? (
            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
          )}
          {signingOut ? 'Signing Out...' : 'Sign Out'}
        </button>
      </div>
    </nav>
  )
}
