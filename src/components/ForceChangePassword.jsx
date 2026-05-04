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

  const eyeOff = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  )
  const eyeOn = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background:'radial-gradient(ellipse at 50% 0%, #1a1a3e 0%, #0a0a0f 60%)'}}>
      <div className="w-full max-w-sm animate-fadeIn">

        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <LogoWithStars imgClassName="w-16 h-16 rounded-2xl object-cover shadow-lg" />
          </div>
          <h1 className="text-2xl font-semibold text-white">أهلاً بك في Finest!</h1>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            هذه أول مرة تفتح حسابك.<br />
            قم بإنشاء باسورد خاص بك للمتابعة.
          </p>
        </div>

        <div className="glass rounded-2xl p-1 mb-4">
          <div className="flex">
            <div className="flex-1 text-center py-2 rounded-xl bg-amber-600/20 border border-amber-500/30">
              <span className="text-amber-400 text-xs font-medium">🔐 إنشاء باسورد — أول مرة فقط</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4 animate-scaleIn">
          {error && (
            <div className="bg-red-900/30 border border-red-500/30 text-red-400 text-sm rounded-lg p-3 animate-fadeIn">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">الباسورد الجديد</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setError('') }}
                placeholder="على الأقل 6 حروف"
                autoComplete="new-password"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 pr-10 transition-all"
              />
              <button type="button" onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                {showNew ? eyeOff : eyeOn}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">تأكيد الباسورد</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setError('') }}
                placeholder="كرر الباسورد الجديد"
                autoComplete="new-password"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 pr-10 transition-all"
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                {showConfirm ? eyeOff : eyeOn}
              </button>
            </div>
          </div>

          {newPassword && confirmPassword && newPassword === confirmPassword && newPassword.length >= 6 && (
            <div className="flex items-center gap-2 text-green-400 text-xs animate-fadeIn">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              الباسوردين متطابقين ✓
            </div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-all mt-2 hover:scale-105"
          >
            {loading ? 'جاري الحفظ...' : '✅ إنشاء الباسورد والدخول'}
          </button>
        </form>

        <p className="text-center text-slate-600 text-xs mt-4">
          هذه الشاشة تظهر مرة واحدة فقط عند أول دخول
        </p>
      </div>
    </div>
  )
}
