import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import LogoWithStars from '../components/LogoWithStars'

const BG_STYLES = { background: '#05050a' }
const CARD_STYLES = {
  background: 'linear-gradient(160deg, rgba(18,20,38,0.98) 0%, rgba(10,12,24,0.98) 100%)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.06) inset',
  backdropFilter: 'blur(24px)',
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) { setVerifying(false); return }
    fetch(`/api/auth/verify-reset-token?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => { setTokenValid(d.valid); setVerifying(false) })
      .catch(() => setVerifying(false))
  }, [token])

  async function handleSubmit(e) {
    e.preventDefault()
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      setDone(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const inputStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#f1f5f9' }
  const focusHandler = e => { e.target.style.borderColor = 'rgba(99,102,241,0.55)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.08)'; e.target.style.background = 'rgba(99,102,241,0.05)' }
  const blurHandler = e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; e.target.style.background = 'rgba(255,255,255,0.04)' }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={BG_STYLES}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] opacity-30"
          style={{ background: 'radial-gradient(ellipse at center, #4f46e5 0%, transparent 65%)', filter: 'blur(60px)' }} />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] opacity-15"
          style={{ background: 'radial-gradient(circle at center, #7c3aed 0%, transparent 65%)', filter: 'blur(80px)' }} />
        <div className="absolute inset-0"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)', backgroundSize: '56px 56px' }} />
      </div>

      <div className="w-full max-w-[360px] relative z-10">
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

            {verifying ? (
              <div className="flex items-center justify-center py-8">
                <svg className="w-6 h-6 animate-spin text-indigo-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : !token || !tokenValid ? (
              <div className="text-center py-4">
                <div className="flex justify-center mb-4">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  </div>
                </div>
                <h2 className="text-white font-semibold text-lg mb-2">Link expired or invalid</h2>
                <p className="text-slate-400 text-sm mb-6">This reset link is no longer valid. Please request a new one.</p>
                <Link to="/forgot-password"
                  className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors">
                  Request new link
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>
            ) : done ? (
              <div className="text-center py-4">
                <div className="flex justify-center mb-4">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <h2 className="text-white font-semibold text-lg mb-2">Password updated!</h2>
                <p className="text-slate-400 text-sm">Your password has been reset successfully. Redirecting you to sign in...</p>
              </div>
            ) : (
              <>
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-1">New Password</p>
                <p className="text-slate-500 text-xs mb-6">Choose a strong password for your account.</p>

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
                  {[
                    { label: 'New password', val: newPassword, setVal: setNewPassword, show: showNew, setShow: setShowNew, placeholder: '••••••••' },
                    { label: 'Confirm password', val: confirmPassword, setVal: setConfirmPassword, show: showConfirm, setShow: setShowConfirm, placeholder: '••••••••' },
                  ].map(({ label, val, setVal, show, setShow, placeholder }) => (
                    <div key={label}>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-widest">{label}</label>
                      <div className="relative">
                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                          </svg>
                        </div>
                        <input
                          type={show ? 'text' : 'password'}
                          required
                          minLength={6}
                          value={val}
                          onChange={e => setVal(e.target.value)}
                          placeholder={placeholder}
                          className="w-full pl-10 pr-11 py-2.5 rounded-xl text-white text-sm outline-none transition-all"
                          style={inputStyle}
                          onFocus={focusHandler}
                          onBlur={blurHandler}
                        />
                        <button type="button" tabIndex={-1} onClick={() => setShow(v => !v)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors">
                          {show ? (
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
                  ))}

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
                        Updating...
                      </span>
                    ) : 'Set New Password'}
                  </button>
                </form>
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
