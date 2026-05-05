import { useState } from 'react'
import { api } from '../lib/api'
import LogoWithStars from './LogoWithStars'

export default function ForceChangePassword({ onDone }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword && newPassword.length >= 6

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (newPassword.length < 6) { setError('الباسورد لازم يكون 6 حروف على الأقل'); return }
    if (newPassword !== confirmPassword) { setError('الباسوردين مش متطابقين'); return }
    setLoading(true)
    try {
      await api.forceChangePassword(newPassword)
      onDone()
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const inputFocusStyle = { borderColor: 'rgba(99,102,241,0.6)', boxShadow: '0 0 0 3px rgba(99,102,241,0.1)' }
  const inputBlurStyle = { borderColor: 'rgba(255,255,255,0.1)', boxShadow: 'none' }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{background:'radial-gradient(ellipse at 50% -10%, #1e1b4b 0%, #0f172a 40%, #0a0a0f 70%)'}}>

      {/* Background decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20" style={{background:'radial-gradient(circle, #4f46e5 0%, transparent 70%)'}} />
        <div className="absolute top-1/2 -right-32 w-80 h-80 rounded-full opacity-10" style={{background:'radial-gradient(circle, #7c3aed 0%, transparent 70%)'}} />
        <div className="absolute -bottom-24 left-1/3 w-72 h-72 rounded-full opacity-15" style={{background:'radial-gradient(circle, #2563eb 0%, transparent 70%)'}} />
        <div className="absolute inset-0" style={{backgroundImage:'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize:'48px 48px'}} />
      </div>

      <div className="w-full max-w-sm relative z-10 animate-fadeIn">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl blur-xl opacity-40" style={{background:'linear-gradient(135deg, #4f46e5, #7c3aed)'}} />
              <LogoWithStars imgClassName="relative w-16 h-16 rounded-2xl object-cover shadow-2xl" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">أهلاً بك!</h1>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            هذه أول مرة تفتح حسابك<br />
            <span className="text-slate-500">أنشئ باسورد خاص بك للمتابعة</span>
          </p>
        </div>

        {/* First-time badge */}
        <div className="flex justify-center mb-5">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full border" style={{background:'rgba(251,146,60,0.08)', borderColor:'rgba(251,146,60,0.2)'}}>
            <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <span className="text-amber-400 text-xs font-medium">إنشاء باسورد — أول مرة فقط</span>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-7 shadow-2xl border border-white/10 animate-scaleIn" style={{background:'rgba(15,23,42,0.85)', backdropFilter:'blur(24px)'}}>
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 text-red-400 text-sm rounded-xl p-3 mb-5 animate-fadeIn">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-widest">الباسورد الجديد</label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <input
                  type={showNew ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={e => { setNewPassword(e.target.value); setError('') }}
                  placeholder="على الأقل 6 حروف"
                  autoComplete="new-password"
                  className="w-full rounded-xl pl-10 pr-11 py-3 text-white text-sm transition-all outline-none border"
                  style={{background:'rgba(255,255,255,0.05)', borderColor:'rgba(255,255,255,0.1)'}}
                  onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                  onBlur={e => Object.assign(e.target.style, inputBlurStyle)}
                />
                <button type="button" onClick={() => setShowNew(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showNew ? (
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
              {newPassword && newPassword.length < 6 && (
                <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  يجب أن يكون 6 حروف على الأقل
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-widest">تأكيد الباسورد</label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setError('') }}
                  placeholder="كرر الباسورد الجديد"
                  autoComplete="new-password"
                  className="w-full rounded-xl pl-10 pr-11 py-3 text-white text-sm transition-all outline-none border"
                  style={{background:'rgba(255,255,255,0.05)', borderColor: confirmPassword && newPassword !== confirmPassword ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}}
                  onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                  onBlur={e => Object.assign(e.target.style, { borderColor: confirmPassword && newPassword !== confirmPassword ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)', boxShadow: 'none' })}
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showConfirm ? (
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
              {passwordsMatch && (
                <p className="text-green-400 text-xs mt-1.5 flex items-center gap-1 animate-fadeIn">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  الباسوردين متطابقين
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full relative overflow-hidden py-3 rounded-xl text-sm font-semibold text-white transition-all mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{background: loading ? 'rgba(217,119,6,0.5)' : 'linear-gradient(135deg, #d97706 0%, #b45309 100%)', boxShadow: loading ? 'none' : '0 4px 20px rgba(217,119,6,0.3)'}}
              onMouseEnter={e => { if (!loading) { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 8px 28px rgba(217,119,6,0.4)' } }}
              onMouseLeave={e => { e.target.style.transform = 'none'; e.target.style.boxShadow = loading ? 'none' : '0 4px 20px rgba(217,119,6,0.3)' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  جاري الحفظ...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  إنشاء الباسورد والدخول
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </span>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">هذه الشاشة تظهر مرة واحدة فقط عند أول دخول</p>
      </div>
    </div>
  )
}
