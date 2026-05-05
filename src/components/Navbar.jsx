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

  function handleToggleMute() {
    toggleMute()
  }

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

        <button
          onClick={handleToggleMute}
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
