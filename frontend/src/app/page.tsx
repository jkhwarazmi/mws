"use client"
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Users, Activity, RefreshCw } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { fetchDashboardData, DashboardData } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

export default function HomePage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const loadDashboardData = useCallback(async (isManualRefresh = false) => {
    try {
      setError(null)
      if (isManualRefresh) {
        setIsRefreshing(true)
      } else {
        setIsLoaded(false)
      }
      const data = await fetchDashboardData()
      setDashboardData(data)
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
      setError('Failed to load dashboard data')
      setDashboardData(null)
    } finally {
      setIsLoaded(true)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    document.title = "Medical Waitlist Management - Dashboard"
    loadDashboardData()
  }, [loadDashboardData])

  const handleRefresh = useCallback(() => {
    loadDashboardData(true)
  }, [loadDashboardData])

  const formatLastUpdated = (date: Date) => {
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-primary mt-3">Medical Waitlist Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome to the Medical Waitlist Management System
          </p>
        </div>
        <div className="flex flex-col items-end">
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
            className="cursor-pointer mt-3"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <div className="text-xs text-muted-foreground mt-1 h-4 flex items-center">
            {lastUpdated ? (
              `Updated at ${formatLastUpdated(lastUpdated)}`
            ) : (
              <Skeleton className="h-3 w-40" />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Appointments</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {!isLoaded ? (
              <>
                <div className="text-2xl font-bold h-8 flex items-center">
                  <Skeleton className="h-6 w-16" />
                </div>
                <div className="text-xs text-muted-foreground h-4 flex items-center">
                  <Skeleton className="h-3 w-32" />
                </div>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-primary h-8 flex items-center">
                  {dashboardData?.total_appointments ?? 'N/A'}
                </div>
                <div className="text-xs text-muted-foreground h-4 flex items-center">
                  Active appointments scheduled
                </div>
              </>
            )}
            <Button asChild className="w-full mt-4" variant="outline">
              <Link href="/appointments">View Appointments</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Waitlist</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {!isLoaded ? (
              <>
                <div className="text-2xl font-bold h-8 flex items-center">
                  <Skeleton className="h-6 w-16" />
                </div>
                <div className="text-xs text-muted-foreground h-4 flex items-center">
                  <Skeleton className="h-3 w-32" />
                </div>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-primary h-8 flex items-center">
                  {dashboardData?.unassigned_patients ?? 'N/A'}
                </div>
                <div className="text-xs text-muted-foreground h-4 flex items-center">
                  Patients on waitlist
                </div>
              </>
            )}
            <Button asChild className="w-full mt-4" variant="outline">
              <Link href="/waitlist">View Waitlist</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {!isLoaded ? (
              <>
                <div className="text-2xl font-bold h-8 flex items-center">
                  <Skeleton className="h-6 w-16" />
                </div>
                <div className="text-xs text-muted-foreground h-4 flex items-center">
                  <Skeleton className="h-3 w-32" />
                </div>
              </>
            ) : (
              <>
                <div className={`text-2xl font-bold h-8 flex items-center ${error ? 'text-red-600' : 'text-green-600'}`}>
                  {error ? 'Offline' : 'Active'}
                </div>
                <div className="text-xs text-muted-foreground h-4 flex items-center">
                  {error ? 'Unable to connect to server' : 'All systems operational'}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
