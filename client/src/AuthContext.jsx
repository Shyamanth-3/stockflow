import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, onUnauthorized } from './api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sessionError, setSessionError] = useState('')

  const checkSession = useCallback(() => {
    setLoading(true)
    setSessionError('')
    api('/auth/me')
      .then((data) => setUser(data.user))
      .catch((err) => {
        setUser(null)
        if (err.status !== 401) setSessionError(err.message)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    checkSession()
    return onUnauthorized(() => setUser(null))
  }, [checkSession])

  async function login(credentials) {
    const data = await api('/auth/login', { method: 'POST', body: credentials })
    setUser(data.user)
  }

  async function signup(details) {
    const data = await api('/auth/signup', { method: 'POST', body: details })
    setUser(data.user)
  }

  async function logout() {
    await api('/auth/logout', { method: 'POST' })
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, sessionError, checkSession, login, signup, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
