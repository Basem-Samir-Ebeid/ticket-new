import { createContext, useContext, useEffect, useState } from 'react'
import { api, connectWS, disconnectWS } from '../lib/api'

const AuthContext = createContext({})
export const useAuth = () => useContext(AuthContext)

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  function handleWsEvent(event, data) {
    if (event === 'session_revoked') {
      forceSignOut()
    }
  }

  async function loadUser() {
    const token = localStorage.getItem('auth_token')
    if (!token) { setLoading(false); return }
    try {
      const prof = await api.me()
      if (!prof) { localStorage.removeItem('auth_token'); setLoading(false); return }
      setUser({ id: prof.id })
      setProfile(prof)
      connectWS(token, handleWsEvent)
    } catch {
      localStorage.removeItem('auth_token')
    }
    setLoading(false)
  }

  useEffect(() => { loadUser() }, [])

  // Re-check profile every 15s and on focus
  useEffect(() => {
    if (!user) return
    const check = async () => {
      try {
        const prof = await api.me()
        if (!prof) { forceSignOut(); return }
        setProfile(prof)
      } catch {
        forceSignOut()
      }
    }
    const interval = setInterval(check, 15000)
    window.addEventListener('focus', check)
    return () => { clearInterval(interval); window.removeEventListener('focus', check) }
  }, [user])

  async function forceSignOut() {
    localStorage.removeItem('auth_token')
    disconnectWS()
    setUser(null)
    setProfile(null)
  }

  async function signIn(email, password) {
    try {
      const { token, user: prof } = await api.login(email, password)
      localStorage.setItem('auth_token', token)
      setUser({ id: prof.id })
      setProfile(prof)
      connectWS(token, handleWsEvent)
      return { data: { user: prof }, error: null }
    } catch (err) {
      return { data: null, error: { message: err.message } }
    }
  }

  async function attemptAttendanceLogout() {
    if (!user) return
    try {
      const todayLogin = await api.getTodayAttendance()
      if (!todayLogin || todayLogin.logout_time) return
      const position = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) { reject(new Error('Geolocation not supported')); return }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 10000, maximumAge: 0,
        })
      })
      await api.registerLogout(position.coords.latitude, position.coords.longitude)
    } catch {}
  }

  async function signOut() {
    await attemptAttendanceLogout()
    await forceSignOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
