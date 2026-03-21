import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { User } from '@lotushack/shared'

interface AuthContextType {
  user: User | null
  token: string | null
  login: (token: string, user: User) => void
  logout: () => void
  isAuthenticated: boolean
  isCandidate: boolean
  isRecruiter: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
  isCandidate: false,
  isRecruiter: false,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))

  useEffect(() => {
    if (token) localStorage.setItem('token', token)
    else localStorage.removeItem('token')
  }, [token])

  useEffect(() => {
    if (user) localStorage.setItem('user', JSON.stringify(user))
    else localStorage.removeItem('user')
  }, [user])

  const login = (newToken: string, newUser: User) => {
    setToken(newToken)
    setUser(newUser)
  }

  const logout = () => {
    setToken(null)
    setUser(null)
  }

  const isCandidate = user?.role === 'candidate'
  const isRecruiter = user?.role === 'recruiter'

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token, isCandidate, isRecruiter }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
