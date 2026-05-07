import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LogoWithStars from '../components/LogoWithStars'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await signIn(email, password)
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{background:'#05050a'}}>

      {/* Layered background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Primary glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] opacity-30"
          style={{background:'radial-gradient(ellipse at center, #4f46e5 0%, transparent 65%)', filter:'blur(60px)'}} />
        {/* Secondary glow */}
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] opacity-15"
          style={{background:'radial-gradient(circle at center, #7c3aed 0%, transparent 65%)', filter:'blur(80px)'}} />
        {/* Tertiary glow */}
        <div className="absolute top-1/3 -left-20 w-[300px] h-[300px] opacity-10"
          style={{background:'radial-gradient(circle at center, #06b6d4 0%, transparent 65%)', filter:'blur(60px)'}} />
        {/* Fine grid */}
        <div className="absolute inset-0"
          style={{
            backgroundImage:'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
            backgroundSize:'56px 56px'
          }} />
        {/* Corner dots */}
        <div className="absolute inset-0"
          style={{
            backgroundImage:'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize:'56px 56px',
            backgroundPosition:'28px 28px'
          }} />
      </div>

      <div className="w-full max-w-[360px] relative z-10 animate-fadeIn">
        {/* Logo & branding */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl opacity-60"
                style={{background:'linear-gradient(135deg,#4f46e5,#7c3aed)', filter:'blur(16px)', transform:'scale(1.1)'}} />
              <div className="relative p-1 rounded-2xl"
                style={{background:'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.2))', border:'1px solid rgba(99,102,241,0.25)'}}>
                <LogoWithStars imgClassName="w-14 h-14 rounded-xl object-cover" />
              </div>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Finest</h1>
          <p className="text-slate-500 text-sm">IT Ticket Management System</p>
        </div>

        {/* Login card */}
        <div className="rounded-2xl overflow-hidden animate-scaleIn"
          style={{
            background:'linear-gradient(160deg, rgba(18,20,38,0.98) 0%, rgba(10,12,24,0.98) 100%)',
            border:'1px solid rgba(255,255,255,0.08)',
            boxShadow:'0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.06) inset',
            backdropFilter:'blur(24px)'
          }}>

          {/* Top accent bar */}
          <div className="h-[1px]" style={{background:'linear-gradient(90deg, transparent, rgba(99,102,241,0.5), rgba(139,92,246,0.4), transparent)'}} />

          <div className="p-7 pt-6">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-6">Sign in to your workspace</p>

            {error && (
              <div className="flex items-start gap-2.5 rounded-xl p-3 mb-5 animate-fadeIn"
                style={{background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)'}}>
                <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-widest">
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="username"
                    placeholder="you@company.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-white text-sm outline-none transition-all"
                    style={{background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#f1f5f9'}}
                    onFocus={e => { e.target.style.borderColor='rgba(99,102,241,0.55)'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.08)'; e.target.style.background='rgba(99,102,241,0.05)' }}
                    onBlur={e => { e.target.style.borderColor='rgba(255,255,255,0.08)'; e.target.style.boxShadow='none'; e.target.style.background='rgba(255,255,255,0.04)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-widest">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full pl-10 pr-11 py-2.5 rounded-xl text-white text-sm outline-none transition-all"
                    style={{background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#f1f5f9'}}
                    onFocus={e => { e.target.style.borderColor='rgba(99,102,241,0.55)'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.08)'; e.target.style.background='rgba(99,102,241,0.05)' }}
                    onBlur={e => { e.target.style.borderColor='rgba(255,255,255,0.08)'; e.target.style.boxShadow='none'; e.target.style.background='rgba(255,255,255,0.04)' }}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <Link to="/forgot-password"
                  className="text-[11px] text-slate-500 hover:text-indigo-400 transition-colors">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full relative overflow-hidden py-2.5 rounded-xl text-sm font-semibold text-white transition-all mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  boxShadow: '0 4px 20px rgba(79,70,229,0.35), 0 0 0 1px rgba(99,102,241,0.2) inset',
                }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.boxShadow = '0 8px 28px rgba(79,70,229,0.5), 0 0 0 1px rgba(99,102,241,0.3) inset'; e.currentTarget.style.transform = 'translateY(-1px)' }}}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(79,70,229,0.35), 0 0 0 1px rgba(99,102,241,0.2) inset'; e.currentTarget.style.transform = 'none' }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Sign In
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </span>
                )}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center mt-6" style={{color:'rgba(255,255,255,0.12)', fontSize:'11px'}}>
          Finest © 2025 — Secure workspace
        </p>
      </div>
    </div>
  )
}
