'use client'

import { useAuth } from '../context/AuthContext'
import { useRouter } from 'next/navigation'
import { ReactNode, useEffect } from 'react'
import { AppLayoutSkeleton } from './app-layout-skeleton'

interface AuthGuardProps {
  children: ReactNode
}

const AuthGuard = ({ children }: AuthGuardProps) => {
  const { user, loading, isVerified, authError } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return <AppLayoutSkeleton />
  }

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Access Denied</h2>
          <p className="text-gray-600">{authError}</p>
        </div>
      </div>
    )
  }

  if (!user || !isVerified) {
    return null // Will redirect via useEffect or still verifying
  }

  // User is signed in and backend-verified, render the protected content
  return <>{children}</>
}

export default AuthGuard