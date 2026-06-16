import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LogoWithStars from '../components/LogoWithStars'

const FEATURES = [
  { icon: 'M16.5 6v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a3 3 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z', label: 'Smart Ticketing', desc: 'AI-powered assignment & SLA tracking' },
  { icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z', label: 'Live Attendance', desc: 'GPS geofencing & real-time check-ins' },
  { icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z', label: 'Advanced Analytics', desc: 'Performance dashboards & PDF reports' },
]

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
    <div className="min-h-screen flex relative overflow-hidden" style={{ background: '#04040c' }}>

      {/* ── Ambient background ── */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 left-1/4 w-[500px] h-[500px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #4f46e5 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] opacity-10"
          style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', filter: 'blur(100px)' }} />
        <div className="absolute top-1/2 left-0 w-[300px] h-[300px] opacity-8"
          style={{ background: 'radial-gradient(circle, #0891b2 0%, transparent 70%)', filter: 'blur(80px)' }} />
        {/* Grid */}
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }} />
      </div>

      {/* ── Left panel (desktop) ── */}
      <div className="hidden lg:flex flex-col justify-between w-[48%] xl:w-[52%] relative p-10 xl:p-14">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-xl opacity-50"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', filter: 'blur(10px)', transform: 'scale(1.15)' }} />
            <div className="relative rounded-xl p-[3px]"
              style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.4), rgba(139,92,246,0.2))' }}>
              <LogoWithStars imgClassName="w-9 h-9 rounded-lg object-cover" />
            </div>
          </div>
          <div>
            <p className="text-white font-bold text-base tracking-tight leading-none">Finest</p>
            <p className="text-slate-500 text-[11px] tracking-wider mt-0.5">IT MANAGEMENT</p>
          </div>
        </div>

        {/* Hero text */}
        <div className="max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 text-[11px] font-semibold uppercase tracking-widest"
            style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Enterprise IT Platform
          </div>
          <h1 className="text-4xl xl:text-5xl font-black text-white leading-[1.1] tracking-tight mb-5">
            Manage your IT<br />
            <span style={{
              background: 'linear-gradient(135deg, #a5b4fc 0%, #c4b5fd 40%, #67e8f9 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
            }}>
              operations smarter
            </span>
          </h1>
          <p className="text-slate-400 text-base leading-relaxed mb-10">
            A unified platform for tickets, attendance, leave management, and team performance — built for teams that move fast.
          </p>

          {/* Feature list */}
          <div className="space-y-4">
            {FEATURES.map((f, i) => (
              <div key={i} className="flex items-start gap-4 group">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-105"
                  style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
                  </svg>
                </div>
                <div>
                  <p className="text-white text-sm font-semibold leading-tight">{f.label}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="flex items-center gap-6">
          <p className="text-slate-600 text-xs">© 2025 Finest. All rights reserved.</p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-emerald-500 text-xs font-medium">All systems operational</span>
          </div>
        </div>
      </div>

      {/* ── Vertical divider ── */}
      <div className="hidden lg:block w-px self-stretch my-8"
        style={{ background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.07) 20%, rgba(255,255,255,0.07) 80%, transparent)' }} />

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-10 xl:p-14 relative">

        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-3 mb-10">
          <div className="relative">
            <div className="absolute inset-0 rounded-xl opacity-60"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', filter: 'blur(10px)', transform: 'scale(1.2)' }} />
            <div className="relative rounded-xl p-[3px]"
              style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.4), rgba(139,92,246,0.2))' }}>
              <LogoWithStars imgClassName="w-10 h-10 rounded-lg object-cover" />
            </div>
          </div>
          <div>
            <p className="text-white font-bold text-lg tracking-tight">Finest</p>
            <p className="text-slate-500 text-xs tracking-wider">IT MANAGEMENT</p>
          </div>
        </div>

        {/* Form card */}
        <div className="w-full max-w-[400px] animate-fadeIn">

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white tracking-tight mb-1.5">Welcome back</h2>
            <p className="text-slate-400 text-sm">Sign in to your workspace to continue</p>
          </div>

          {/* Card */}
          <div className="rounded-2xl p-7" style={{
            background: 'linear-gradient(145deg, rgba(16,18,36,0.97) 0%, rgba(10,12,24,0.97) 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.05) inset',
            backdropFilter: 'blur(32px)',
          }}>
            {/* Top shimmer line */}
            <div className="absolute top-0 left-0 right-0 h-px rounded-t-2xl"
              style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.6) 30%, rgba(139,92,246,0.5) 60%, transparent 100%)' }} />

            {error && (
              <div className="flex items-start gap-2.5 rounded-xl p-3 mb-5 animate-fadeIn"
                style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)' }}>
                <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-2 uppercase tracking-widest">
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                  </div>
                  <input
                    type="email" required value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="username"
                    placeholder="you@company.com"
                    className="login-input w-full pl-10 pr-4 py-3 rounded-xl text-white text-sm outline-none transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
                    Password
                  </label>
                  <Link to="/forgot-password" className="text-[11px] text-indigo-500 hover:text-indigo-400 transition-colors font-medium">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'} required value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="login-input w-full pl-10 pr-11 py-3 rounded-xl text-white text-sm outline-none transition-all"
                  />
                  <button type="button" tabIndex={-1}
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors p-0.5">
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

              {/* Submit */}
              <button
                type="submit" disabled={loading}
                className="login-btn w-full relative overflow-hidden py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-1"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </>
                  )}
                </span>
              </button>
            </form>
          </div>

          {/* Security note */}
          <div className="flex items-center justify-center gap-2 mt-5">
            <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            <p className="text-slate-600 text-[11px]">Secured with enterprise-grade encryption</p>
          </div>
        </div>
      </div>
    </div>
  )
}
