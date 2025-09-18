"use client"

import { useState, useEffect } from 'react'
import { fetchDepartments, fetchHospitals, Department, Hospital } from '@/lib/api'

// Cache duration: 1 hour
const CACHE_DURATION = 60 * 60 * 1000

interface CacheEntry<T> {
  data: T
  timestamp: number
}

// Generic cache utility
function getCachedData<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  
  try {
    const cached = localStorage.getItem(key)
    if (!cached) return null
    
    const { data, timestamp }: CacheEntry<T> = JSON.parse(cached)
    
    // Check if cache is still valid
    if (Date.now() - timestamp < CACHE_DURATION) {
      return data
    }
    
    // Remove expired cache
    localStorage.removeItem(key)
    return null
  } catch {
    return null
  }
}

function setCachedData<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return
  
  try {
    const cacheEntry: CacheEntry<T> = {
      data,
      timestamp: Date.now()
    }
    localStorage.setItem(key, JSON.stringify(cacheEntry))
  } catch {
    // Handle storage quota exceeded or other errors
    console.warn(`Failed to cache ${key}`)
  }
}

// Hook for departments
export function useDepartments() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadDepartments() {
      // Try cache first
      const cached = getCachedData<Department[]>('departments')
      if (cached) {
        setDepartments(cached)
        setIsLoading(false)
        return
      }

      // Fetch from API
      try {
        const data = await fetchDepartments()
        if (isMounted) {
          setDepartments(data)
          setCachedData('departments', data)
          setError(null)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load departments')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadDepartments()

    return () => {
      isMounted = false
    }
  }, [])

  const getDepartmentName = (id: string): string => {
    const dept = departments.find(d => d.department_id === id)
    return dept?.department_name || `Department ${id}`
  }

  const refreshDepartments = async () => {
    setIsLoading(true)
    localStorage.removeItem('departments')
    
    try {
      const data = await fetchDepartments()
      setDepartments(data)
      setCachedData('departments', data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh departments')
    } finally {
      setIsLoading(false)
    }
  }

  return {
    departments,
    isLoading,
    error,
    getDepartmentName,
    refreshDepartments
  }
}

// Hook for hospitals
export function useHospitals() {
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadHospitals() {
      // Try cache first
      const cached = getCachedData<Hospital[]>('hospitals')
      if (cached) {
        setHospitals(cached)
        setIsLoading(false)
        return
      }

      // Fetch from API
      try {
        const data = await fetchHospitals()
        if (isMounted) {
          setHospitals(data)
          setCachedData('hospitals', data)
          setError(null)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load hospitals')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadHospitals()

    return () => {
      isMounted = false
    }
  }, [])

  const getHospitalName = (id: string): string => {
    const hospital = hospitals.find(h => h.hospital_id === id)
    return hospital?.hospital_name || `Hospital ${id}`
  }

  const refreshHospitals = async () => {
    setIsLoading(true)
    localStorage.removeItem('hospitals')
    
    try {
      const data = await fetchHospitals()
      setHospitals(data)
      setCachedData('hospitals', data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh hospitals')
    } finally {
      setIsLoading(false)
    }
  }

  return {
    hospitals,
    isLoading,
    error,
    getHospitalName,
    refreshHospitals
  }
}
