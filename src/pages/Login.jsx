import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetMsg, setResetMsg] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await signIn(email, password)
    if (error) setError(error.message)
    setLoading(false)
  }

  async function handleReset(e) {
    e.preventDefault()
    setLoading(true); setResetMsg('')
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      setResetMsg('Error: ' + error.message)
    } else {
      setResetMsg('✓ Check your email for reset link')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background:'radial-gradient(ellipse at 50% 0%, #1a1a3e 0%, #0a0a0f 60%)'}}>
      <div className="w-full max-w-sm animate-fadeIn">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 mb-4 animate-scaleIn">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-white">IT Ticket System</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to your account</p>
        </div>

        {!showReset ? (
          <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4 animate-scaleIn">
            {error && <div className="bg-red-900/30 border border-red-500/30 text-red-400 text-sm rounded-lg p-3 animate-fadeIn">{error}</div>}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">Email</label>
              <input
                type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">Password</label>
              <input
                type="password" required value={password} onChange={e => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-all mt-2 hover:scale-105"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={() => setShowReset(true)}
              className="w-full text-slate-400 hover:text-white text-xs mt-2"
            >
              Forgot password?
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="glass rounded-2xl p-6 space-y-4 animate-scaleIn">
            {resetMsg && <div className={`${resetMsg.includes('Error') ? 'bg-red-900/30 border-red-500/30 text-red-400' : 'bg-green-900/30 border-green-500/30 text-green-400'} border text-sm rounded-lg p-3 animate-fadeIn`}>{resetMsg}</div>}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">Email</label>
              <input
                type="email" required value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                placeholder="you@company.com"
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-all hover:scale-105"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <button
              type="button"
              onClick={() => { setShowReset(false); setResetMsg('') }}
              className="w-full text-slate-400 hover:text-white text-xs"
            >
              ← Back to Sign In
            </button>
          </form>
        )}
      </div>
    </div>
  )
}