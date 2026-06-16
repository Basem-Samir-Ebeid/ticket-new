import { useState } from 'react'
import { Link } from 'react-router-dom'
import LogoWithStars from '../components/LogoWithStars'

const BG_STYLES = {
  background: 'radial-gradient(ellipse at 50% -10%, rgba(49,46,129,0.28) 0%, transparent 55%), #04040c',
}
const CARD_STYLES = {
  background: 'linear-gradient(160deg, rgba(18,20,38,0.98) 0%, rgba(10,12,24,0.98) 100%)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.06) inset',
  backdropFilter: 'blur(24px)',
}

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      setSent(true)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={BG_STYLES}>
      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] opacity-30"
          style={{ background: 'radial-gradient(ellipse at center, #4f46e5 0%, transparent 65%)', filter: 'blur(60px)' }} />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] opacity-15"
          style={{ background: 'radial-gradient(circle at center, #7c3aed 0%, transparent 65%)', filter: 'blur(80px)' }} />
        <div className="absolute inset-0"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)', backgroundSize: '56px 56px' }} />
      </div>

      <div className="w-full max-w-[360px] relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl opacity-60"
                style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', filter: 'blur(16px)', transform: 'scale(1.1)' }} />
              <div className="relative p-1 rounded-2xl"
                style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.2))', border: '1px solid rgba(99,102,241,0.25)' }}>
                <LogoWithStars imgClassName="w-14 h-14 rounded-xl object-cover" />
              </div>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Finest</h1>
          <p className="text-slate-500 text-sm">IT Ticket Management System</p>
        </div>

        <div className="rounded-2xl overflow-hidden" style={CARD_STYLES}>
          <div className="h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.5), rgba(139,92,246,0.4), transparent)' }} />

          <div className="p-7 pt-6">
            {sent ? (
              <div className="text-center py-4">
                {/* Success icon */}
                <div className="flex justify-center mb-5">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                  </div>
                </div>
                <h2 className="text-white font-semibold text-lg mb-2">Check your email</h2>
                <p className="text-slate-400 text-sm mb-6">
                  If <span className="text-white font-medium">{email}</span> is registered, you'll receive a password reset link shortly. The link expires in 1 hour.
                </p>
                <Link to="/login"
                  className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                  </svg>
                  Back to Sign In
                </Link>
              </div>
            ) : (
              <>
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-1">Reset Password</p>
                <p className="text-slate-500 text-xs mb-6">Enter your email and we'll send you a reset link.</p>

                {error && (
                  <div className="flex items-start gap-2.5 rounded-xl p-3 mb-5"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
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
                        placeholder="you@company.com"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl text-white text-sm outline-none transition-all"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#f1f5f9' }}
                        onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.55)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.08)'; e.target.style.background = 'rgba(99,102,241,0.05)' }}
                        onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; e.target.style.background = 'rgba(255,255,255,0.04)' }}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', boxShadow: '0 4px 20px rgba(79,70,229,0.35)' }}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Sending...
                      </span>
                    ) : 'Send Reset Link'}
                  </button>
                </form>

                <div className="mt-5 text-center">
                  <Link to="/login"
                    className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xs transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                    Back to Sign In
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        <p className="text-center mt-6" style={{ color: 'rgba(255,255,255,0.12)', fontSize: '11px' }}>
          Finest © 2025 — Secure workspace
        </p>
      </div>
    </div>
  )
}
