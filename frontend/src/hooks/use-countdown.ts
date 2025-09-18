"use client"

import { useState, useEffect } from 'react'

// Global timer for synchronized countdowns
class GlobalTimer {
  private timer: NodeJS.Timeout | null = null
  private subscribers: Set<() => void> = new Set()

  subscribe(callback: () => void) {
    this.subscribers.add(callback)
    
    // Start timer if this is the first subscriber
    if (this.subscribers.size === 1) {
      this.start()
    }

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback)
      // Stop timer if no more subscribers
      if (this.subscribers.size === 0) {
        this.stop()
      }
    }
  }

  private start() {
    if (this.timer) return
    
    this.timer = setInterval(() => {
      this.subscribers.forEach(callback => callback())
    }, 1000)
  }

  private stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }
}

const globalTimer = new GlobalTimer()

export function useCountdown(targetDate: string | null) {
  const [timeLeft, setTimeLeft] = useState<{
    total: number
    days: number
    hours: number
    minutes: number
    seconds: number
  } | null>(null)

  useEffect(() => {
    if (!targetDate) {
      setTimeLeft(null)
      return
    }

    const calculateTimeLeft = () => {
      const now = new Date().getTime()
      const target = new Date(targetDate).getTime()
      const difference = target - now

      if (difference <= 0) {
        return {
          total: 0,
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0
        }
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24))
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((difference % (1000 * 60)) / 1000)

      return {
        total: difference,
        days,
        hours,
        minutes,
        seconds
      }
    }

    // Initial calculation
    setTimeLeft(calculateTimeLeft())

    // Subscribe to global timer
    const unsubscribe = globalTimer.subscribe(() => {
      setTimeLeft(calculateTimeLeft())
    })

    return unsubscribe
  }, [targetDate])

  return timeLeft
}