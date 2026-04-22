import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

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
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <span className="font-semibold text-white">{title}</span>
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
