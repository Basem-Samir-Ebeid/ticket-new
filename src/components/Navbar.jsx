import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import LogoWithStars from './LogoWithStars'

export default function Navbar({ title }) {
  const { profile, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
    setSigningOut(false)
  }

  return (
    <nav className="border-b border-white/8 px-6 py-4 flex items-center justify-between" style={{background:'rgba(10,10,15,0.8)', backdropFilter:'blur(12px)'}}>
      <div className="flex flex-col items-center">
        <LogoWithStars imgClassName="w-8 h-8 rounded-lg object-cover" />
        <span className="font-semibold text-white text-xs mt-0.5">{title}</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <p className="text-sm text-white">{profile?.full_name || profile?.email}</p>
          <p className="text-xs text-slate-400 capitalize">{profile?.role}</p>
        </div>
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
