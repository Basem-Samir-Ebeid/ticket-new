import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import LogoWithStars from './LogoWithStars'
import { isMuted, toggleMute } from '../lib/sound'

export default function Navbar({ title }) {
  const { profile, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [muted, setMuted] = useState(isMuted())

  useEffect(() => {
    const handler = (e) => setMuted(e.detail)
    window.addEventListener('sound:mute_changed', handler)
    return () => window.removeEventListener('sound:mute_changed', handler)
  }, [])

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
    setSigningOut(false)
  }

  return (
    <nav className="sticky top-0 z-30 px-4 sm:px-6 py-0 flex items-center justify-between h-14"
      style={{
        background: 'rgba(5,5,10,0.90)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 1px 0 0 rgba(255,255,255,0.03)',
      }}>
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="absolute inset-0 rounded-xl blur-sm opacity-40" style={{background:'linear-gradient(135deg,#4f46e5,#7c3aed)'}} />
          <LogoWithStars imgClassName="relative w-7 h-7 rounded-lg object-cover" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-white text-sm tracking-tight">Finest</span>
          <span className="hidden sm:block w-1 h-1 rounded-full bg-slate-600" />
          <span className="hidden sm:block text-slate-500 text-xs">IT Management</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {profile && (
          <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl mr-1"
            style={{background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)'}}>
            {profile?.profile_picture_url ? (
              <img src={profile.profile_picture_url} alt={profile.full_name || 'User'}
                className="w-6 h-6 rounded-full object-cover border border-white/10 flex-shrink-0" />
            ) : (
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold"
                style={{background:'linear-gradient(135deg,#4f46e5,#7c3aed)'}}>
                {(profile?.full_name || profile?.email || '?')[0].toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-white leading-tight">{profile?.full_name || profile?.email}</p>
              <p className="text-[10px] text-slate-500 capitalize leading-tight">{profile?.role?.replace('_', ' ')}</p>
            </div>
          </div>
        )}

        <button
          onClick={toggleMute}
          title={muted ? 'Enable notifications' : 'Mute notifications'}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
          style={{
            background: muted ? 'rgba(255,255,255,0.04)' : 'rgba(59,130,246,0.08)',
            border: muted ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(59,130,246,0.2)',
            color: muted ? '#64748b' : '#60a5fa'
          }}
        >
          {muted ? (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
            </svg>
          )}
        </button>

        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex items-center gap-1.5 text-xs font-medium text-red-400 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-all"
          style={{background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.15)'}}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.14)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.28)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.15)' }}
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
          <span className="hidden sm:inline">{signingOut ? 'Signing out...' : 'Sign Out'}</span>
        </button>
      </div>
    </nav>
  )
}
