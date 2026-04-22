// src/context/AuthContext.jsx

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

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

  async function loadProfile(userId) {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()

    if (error) {
      throw error
    }

    setProfile(data ?? null)
    return data ?? null
  }

  async function forceLocalSignOut() {
    setUser(null)
    setProfile(null)
    await supabase.auth.signOut()
  }

  async function ensureActiveAccount(userId) {
    try {
      const activeProfile = await loadProfile(userId)

      // If the user's profile was deleted by admin, end the local session too.
      if (!activeProfile) {
        await forceLocalSignOut()
        return false
      }

      return true
    } catch (_) {
      return true
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) ensureActiveAccount(session.user.id)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      if (session?.user) ensureActiveAccount(session.user.id)
      else setProfile(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) return

    const checkSessionProfile = () => {
      ensureActiveAccount(user.id)
    }

    const intervalId = window.setInterval(checkSessionProfile, 15000)
    window.addEventListener('focus', checkSessionProfile)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', checkSessionProfile)
    }
  }, [user])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`session-revocations:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'session_revocations',
        filter: `user_id=eq.${user.id}`
      }, async () => {
        await forceLocalSignOut()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password })

  async function attemptAttendanceLogout() {
    if (!user || typeof window === 'undefined') return

    try {
      const { data: todayLogin, error: loginError } = await supabase
        .from('login_times')
        .select('id, logout_time')
        .eq('user_id', user.id)
        .eq('date', getLocalDateString())
        .maybeSingle()

      if (loginError || !todayLogin || todayLogin.logout_time) return

      const position = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation not supported'))
          return
        }

        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        })
      })

      await supabase.rpc('register_logout', {
        user_lat: position.coords.latitude,
        user_lon: position.coords.longitude,
      })
    } catch (_) {
      // Keep sign-out working even if attendance sign-off cannot be saved.
    }
  }

  async function signOut() {
    await attemptAttendanceLogout()
    return supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
