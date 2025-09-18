'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { onAuthStateChanged, User, signOut } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { verifyAuth } from '../lib/api'
import { toast } from '../hooks/use-toast'

interface AuthContextType {
  user: User | null
  loading: boolean
  isVerified: boolean
  authError: string | null
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isVerified: false,
  authError: null,
})

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isVerified, setIsVerified] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true)
      setAuthError(null)
      setIsVerified(false)

      if (!firebaseUser) {
        setUser(null)
        setLoading(false)
        return
      }

      // Firebase user exists, now verify with backend
      try {
        await verifyAuth()
        // Backend verification successful
        setUser(firebaseUser)
        setIsVerified(true)
      } catch (error) {
        console.error('Backend verification failed:', error)
        const errorMessage = error instanceof Error ? error.message : 'Authentication verification failed.'
        setAuthError(errorMessage)
        
        // Show error toast
        toast({
          variant: "destructive",
          title: "Access Denied",
          description: errorMessage,
        })
        
        // Sign out the user since backend denied access
        await signOut(auth)
        setUser(null)
        setIsVerified(false)
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, isVerified, authError }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)