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
    <nav className="border-b border-white/8 px-4 sm:px-6 py-3.5 flex items-center justify-between sticky top-0 z-30" style={{background:'rgba(10,10,15,0.92)', backdropFilter:'blur(20px)'}}>
      <div className="flex items-center gap-3">
        <LogoWithStars imgClassName="w-8 h-8 rounded-lg object-cover" />
        <span className="font-semibold text-white text-sm tracking-tight">{title}</span>
      </div>

      <div className="flex items-center gap-2">
        {/* Profile */}
        <div className="flex items-center gap-2.5 mr-1">
          {profile?.profile_picture_url ? (
            <img src={profile.profile_picture_url} alt={profile.full_name || 'User'} className="w-8 h-8 rounded-full object-cover border border-white/15 flex-shrink-0" />
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
