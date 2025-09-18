'use client'

import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { auth } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

const SignInPage = () => {
  const { user, loading, authError } = useAuth()
  const router = useRouter()
  const [isSigningIn, setIsSigningIn] = useState(false)

  useEffect(() => {
    document.title = "Medical Waitlist Management - Login"
    if (user) {
      router.push('/')
    }
  }, [user, router])

  const handleSignIn = async () => {
    setIsSigningIn(true)
    const provider = new GoogleAuthProvider()

    try {
      await signInWithPopup(auth, provider)
      // AuthContext will handle backend verification automatically
      // User will be redirected by useEffect if verification succeeds
    } catch (error) {
      console.error("Sign-in error", error)
    } finally {
      setIsSigningIn(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-primary text-primary-foreground p-4">
        <div className="flex flex-col items-center space-y-8 w-full max-w-md">
          {/* Large Medical Text - Always present */}
          <h1 className="text-6xl font-bold text-white" style={{ fontFamily: 'Frutiger, Arial, sans-serif' }}>Medical</h1>
          
          {/* Sign-in Box Skeleton */}
          <div className="flex flex-col items-center space-y-4">
            <Skeleton className="w-48 h-10 bg-primary-foreground/20 rounded-md" />
          </div>
        </div>
      </div>
    )
  }

  if (user) {
    return null // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-primary text-primary-foreground p-4">
      <div className="flex flex-col items-center space-y-8 w-full max-w-md">
        {/* Large Medical Text */}
        <h1 className="text-6xl font-bold text-white" style={{ fontFamily: 'Frutiger, Arial, sans-serif' }}>Medical Waitlist</h1>
        
        {/* White Sign-in Box */}
        <button
          onClick={handleSignIn}
          disabled={isSigningIn}
          className="w-48 flex items-center justify-center px-2 py-2 border border-gray-300 rounded-md shadow-sm text-lg font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSigningIn ? 'Signing In...' : 'Sign In'}
        </button>
        {authError && (
          <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
            {authError}
          </div>
        )}
      </div>
    </div>
  )
}

export default SignInPage