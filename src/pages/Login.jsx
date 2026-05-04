import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import LogoWithStars from '../components/LogoWithStars'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    <div className="min-h-screen flex items-center justify-center p-4" style={{background:'radial-gradient(ellipse at 50% 0%, #1a1a3e 0%, #0a0a0f 60%)'}}>
      <div className="w-full max-w-sm animate-fadeIn">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <LogoWithStars imgClassName="w-16 h-16 rounded-2xl object-cover animate-scaleIn shadow-lg" />
          </div>
          <h1 className="text-2xl font-semibold text-white">Finest</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to your account</p>
        </div>

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
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-all mt-2 hover:scale-105"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
