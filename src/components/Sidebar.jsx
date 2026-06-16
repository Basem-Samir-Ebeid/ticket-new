import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import LogoWithStars from './LogoWithStars'
import { isMuted, toggleMute } from '../lib/sound'
import { api } from '../lib/api'
import GlobalSearch from './GlobalSearch'

const ICONS = {
  dashboard:   'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
  tickets:     'M16.5 6v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a3 3 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z',
  requests:    'M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z',
  leave:       'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  users:       'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  attendance:  'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  performance: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
  settings:    'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z',
  assigned:    'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z',
  myTickets:   'M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z',
  notifications:'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0',
  myTicketsB:  'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z',
  profile:     'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
  assets:      'M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 15V5.25m19.5 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 7.409A2.25 2.25 0 012.25 5.493V5.25',
  whatsapp:    'M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z',
  factory:     'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21',
  overtime:    'M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z',
  missions:    'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z',
}

function NavIcon({ name, size = 'w-[17px] h-[17px]' }) {
  return (
    <svg className={`${size} flex-shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[name] || ICONS.dashboard} />
    </svg>
  )
}

export default function Sidebar({ tabs, activeTab, onTabChange, isSuperAdmin = false }) {
  const { profile, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [muted, setMuted] = useState(isMuted())
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const notifRef = useRef(null)
  const swipeStartX = useRef(null)
  const swipeStartY = useRef(null)

  const isAmber = isSuperAdmin
  const accentColor = isAmber ? '#f59e0b' : '#6366f1'
  const accentLight = isAmber ? '#fbbf24' : '#a5b4fc'
  const accentBg = isAmber
    ? 'linear-gradient(135deg, rgba(245,158,11,0.16), rgba(217,119,6,0.08))'
    : 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(139,92,246,0.1))'
  const accentBorder = isAmber ? 'rgba(245,158,11,0.28)' : 'rgba(99,102,241,0.28)'
  const accentGlow = isAmber ? '0 0 16px rgba(245,158,11,0.1)' : '0 0 16px rgba(99,102,241,0.12)'

  const badgeBg    = isAmber ? 'rgba(245,158,11,0.2)'   : 'rgba(99,102,241,0.25)'
  const badgeColor = isAmber ? '#fbbf24'                 : '#a5b4fc'
  const unreadCount = notifs.length

  useEffect(() => {
    const handler = (e) => setMuted(e.detail)
    window.addEventListener('sound:mute_changed', handler)
    return () => window.removeEventListener('sound:mute_changed', handler)
  }, [])

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    const intent = { current: null }
    function hasHorizontalScroll(el) {
      while (el && el !== document.body) {
        const style = window.getComputedStyle(el)
        const ox = style.overflowX
        if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth) return true
        el = el.parentElement
      }
      return false
    }
    const onTouchStart = (e) => {
      if (open) return
      if (hasHorizontalScroll(e.target)) { swipeStartX.current = null; return }
      swipeStartX.current = e.touches[0].clientX
      swipeStartY.current = e.touches[0].clientY
      intent.current = null
    }
    const onTouchMove = (e) => {
      if (open || intent.current !== null || swipeStartX.current === null) return
      const dx = Math.abs(e.touches[0].clientX - swipeStartX.current)
      const dy = Math.abs(e.touches[0].clientY - swipeStartY.current)
      if (dx < 8 && dy < 8) return
      intent.current = dy > dx ? 'v' : 'h'
    }
    const onTouchEnd = (e) => {
      if (open || intent.current !== 'h' || swipeStartX.current === null) {
        swipeStartX.current = null; swipeStartY.current = null; intent.current = null; return
      }
      const dx = e.changedTouches[0].clientX - swipeStartX.current
      swipeStartX.current = null; swipeStartY.current = null; intent.current = null
      if (Math.abs(dx) < 60) return
      const idx = tabs.findIndex(t => t.key === activeTab)
      if (dx < 0 && idx < tabs.length - 1) onTabChange(tabs[idx + 1].key)
      else if (dx > 0 && idx > 0) onTabChange(tabs[idx - 1].key)
    }
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove',  onTouchMove,  { passive: true })
    document.addEventListener('touchend',   onTouchEnd,   { passive: true })
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove',  onTouchMove)
      document.removeEventListener('touchend',   onTouchEnd)
    }
  }, [open, tabs, activeTab, onTabChange])

  useEffect(() => {
    fetchNotifications()
    const intervalId = setInterval(fetchNotifications, 30000)
    const onWsNotif = () => fetchNotifications()
    window.addEventListener('ws:notification', onWsNotif)
    return () => { clearInterval(intervalId); window.removeEventListener('ws:notification', onWsNotif) }
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    if (notifOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [notifOpen])

  async function fetchNotifications() {
    try { setNotifs(await api.getNotifications()) } catch {}
  }
  async function handleMarkAllRead() {
    setMarkingAll(true)
    try { await api.markAllRead(); setNotifs([]); setNotifOpen(false) } catch {}
    setMarkingAll(false)
  }
  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
    setSigningOut(false)
  }
  function handleTabClick(key) { onTabChange(key); setOpen(false) }

  const topBarStyle = {
    background: 'rgba(4,4,12,0.97)',
    backdropFilter: 'blur(28px)',
    WebkitBackdropFilter: 'blur(28px)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  }
  const sidebarStyle = {
    background: 'rgba(4,4,12,0.97)',
    backdropFilter: 'blur(28px)',
    WebkitBackdropFilter: 'blur(28px)',
    borderRight: '1px solid rgba(255,255,255,0.06)',
  }

  /* ── Notification Panel ── */
  const BellButton = () => (
    <div className="relative" ref={notifRef}>
      <button
        onClick={() => setNotifOpen(v => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150"
        style={{
          background: notifOpen ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${notifOpen ? 'rgba(99,102,241,0.22)' : 'rgba(255,255,255,0.07)'}`,
          color: unreadCount > 0 ? '#a5b4fc' : '#475569',
        }}
      >
        <div className="relative flex-shrink-0">
          <svg className="w-[17px] h-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
            <path strokeLinecap="round" strokeLinejoin="round" d={ICONS.notifications} />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[9px] font-bold"
              style={{ background: '#ef4444', color: 'white' }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        <span className="text-[12.5px] font-medium flex-1 text-left">
          {unreadCount > 0 ? `${unreadCount} unread` : 'Notifications'}
        </span>
      </button>

      {notifOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl overflow-hidden shadow-2xl animate-scaleIn"
          style={{ background: 'rgba(8,9,20,0.99)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(32px)', zIndex: 100 }}>
          <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-2">
              <span className="text-white text-[12px] font-semibold">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                  style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}>{unreadCount}</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} disabled={markingAll}
                className="text-[11px] font-medium transition-colors disabled:opacity-50"
                style={{ color: isAmber ? '#fbbf24' : '#818cf8' }}>
                {markingAll ? 'Marking...' : 'Mark all read'}
              </button>
            )}
          </div>
          <div className="overflow-y-auto max-h-64">
            {notifs.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                </div>
                <p className="text-slate-600 text-xs font-medium">All caught up</p>
              </div>
            ) : (
              notifs.map(n => (
                <div key={n.id} className="px-3 py-2.5 transition-colors hover:bg-white/3"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <p className="text-slate-300 text-[12.5px] leading-relaxed">{n.message}</p>
                  <p className="text-slate-600 text-[10px] mt-0.5">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )

  /* ── Sidebar content ── */
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Mobile close */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 lg:hidden">
        <p className="text-[9px] uppercase tracking-[0.14em] font-bold" style={{ color: '#2d3a4f' }}>Navigation</p>
        <button onClick={() => setOpen(false)}
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Section label (desktop) */}
      <div className="hidden lg:flex items-center gap-2 px-5 pt-5 pb-3 flex-shrink-0">
        <p className="text-[9px] uppercase tracking-[0.14em] font-bold" style={{ color: '#2d3a4f' }}>Navigation</p>
        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.04)' }} />
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-0.5 pb-2" style={{ scrollbarWidth: 'none' }}>
        {tabs.map(({ key, label, icon, badge }) => {
          const isActive = activeTab === key
          return (
            <button
              key={key}
              onClick={() => handleTabClick(key)}
              className="relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group"
              style={isActive ? {
                background: accentBg,
                border: `1px solid ${accentBorder}`,
                color: accentLight,
                boxShadow: accentGlow,
              } : { color: '#4a5a72', border: '1px solid transparent' }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#4a5a72'; e.currentTarget.style.borderColor = 'transparent' } }}
            >
              {/* Active indicator */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full"
                  style={{ height: '55%', background: accentColor, boxShadow: `0 0 8px ${accentColor}` }} />
              )}

              <span className={`transition-all duration-150 ${isActive ? 'scale-105' : 'group-hover:scale-105'}`}>
                <NavIcon name={icon} />
              </span>
              <span className="flex-1 text-left text-[12.5px] font-medium leading-none">{label}</span>
              {badge > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-md text-[10px] font-bold"
                  style={{ background: badgeBg, color: badgeColor }}>{badge}</span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Divider */}
      <div className="mx-4 my-2 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)' }} />

      {/* Bottom actions */}
      <div className="px-3 pb-5 space-y-1 flex-shrink-0">
        <BellButton />

        {/* Sound toggle */}
        <button
          onClick={toggleMute}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150"
          style={{
            background: muted ? 'rgba(255,255,255,0.03)' : 'rgba(59,130,246,0.07)',
            border: muted ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(59,130,246,0.16)',
            color: muted ? '#3d4f65' : '#60a5fa',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
        >
          {muted ? (
            <svg className="w-[17px] h-[17px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
            </svg>
          ) : (
            <svg className="w-[17px] h-[17px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
            </svg>
          )}
          <span className="text-[12.5px] font-medium">{muted ? 'Sound muted' : 'Sound on'}</span>
        </button>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 disabled:opacity-60"
          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)', color: '#ef4444' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.24)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.12)' }}
        >
          {signingOut ? (
            <svg className="w-[17px] h-[17px] animate-spin flex-shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-[17px] h-[17px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
          )}
          <span className="text-[12.5px]">{signingOut ? 'Signing out...' : 'Sign Out'}</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* ── Top Bar ── */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-4 gap-4" style={topBarStyle}>
        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen(true)}
          className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl transition-all flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="relative">
            <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: '#64748b' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-red-500 flex items-center justify-center text-[8px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
        </button>

        {/* Logo */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="relative">
            <div className="absolute inset-0 rounded-xl opacity-40"
              style={{ background: isAmber ? 'linear-gradient(135deg,#d97706,#92400e)' : 'linear-gradient(135deg,#4f46e5,#7c3aed)', filter: 'blur(8px)', transform: 'scale(1.2)' }} />
            <div className="relative rounded-xl p-[2px]"
              style={{ background: isAmber ? 'linear-gradient(135deg, rgba(245,158,11,0.3), rgba(217,119,6,0.15))' : 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.15))' }}>
              <LogoWithStars imgClassName="relative w-7 h-7 rounded-lg object-cover" />
            </div>
          </div>
          <div>
            <p className="text-white font-bold text-[13.5px] tracking-tight leading-none">Finest</p>
            <p className="text-[9.5px] leading-none tracking-wider mt-0.5 font-medium uppercase"
              style={{ color: isAmber ? '#78350f' : '#312e81', letterSpacing: '0.08em' }}>
              IT Management
            </p>
          </div>
        </div>

        <div className="flex-1" />

        <GlobalSearch />

        {/* User info */}
        {profile && (
          <div className="flex items-center gap-2.5">
            <div className="hidden sm:block text-right">
              <p className="text-white text-[12.5px] font-semibold leading-tight truncate max-w-[140px]">{profile?.full_name || profile?.email}</p>
              <p className="text-[10px] leading-tight mt-0.5 capitalize font-medium"
                style={{ color: isAmber ? '#d97706' : '#6366f1' }}>
                {profile?.role?.replace(/_/g, ' ')}
              </p>
            </div>
            <div className="relative">
              {profile?.profile_picture_url ? (
                <img src={profile.profile_picture_url} alt={profile.full_name || 'User'}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                  style={{ border: `2px solid ${isAmber ? 'rgba(245,158,11,0.35)' : 'rgba(99,102,241,0.35)'}` }} />
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                  style={{
                    background: isAmber ? 'linear-gradient(135deg,#d97706,#b45309)' : 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                    border: `2px solid ${isAmber ? 'rgba(245,158,11,0.3)' : 'rgba(99,102,241,0.3)'}`,
                  }}>
                  {(profile?.full_name || profile?.email || '?')[0].toUpperCase()}
                </div>
              )}
              {/* Online dot */}
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2"
                style={{ borderColor: 'rgba(4,4,12,0.97)' }} />
            </div>
          </div>
        )}
      </header>

      {/* ── Mobile overlay ── */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute top-0 left-0 bottom-0 w-[260px] animate-slideIn" style={sidebarStyle}>
            <div className="h-14" />
            <SidebarContent />
          </div>
        </div>
      )}

      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex fixed left-0 top-14 bottom-0 w-64 flex-col z-30" style={sidebarStyle}>
        <SidebarContent />
      </aside>
    </>
  )
}
