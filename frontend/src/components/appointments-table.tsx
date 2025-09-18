"use client"

import React from "react"

// Global tracker to prevent multiple modal opens across component instances
let globalUrlModalHandled: string | null = null

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { AppointmentModal } from "@/components/appointment-modal"
import { AssignmentResultsModal } from "@/components/assignment-results-modal"
import { AddAppointmentModal } from "@/components/add-appointment-modal"
import { AppointmentsTableSkeleton } from "@/components/appointments-table-skeleton"
import { useDepartments, useHospitals } from "@/hooks/use-reference-data"
import { fetchAppointments, assignSelectedAppointments, Appointment, AssignmentResult } from "@/lib/api"
import { TablePagination } from "@/components/table-pagination"
import { useEffect, useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useIsMobile } from "@/hooks/use-mobile"
import { RefreshCw, Calendar, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { SearchInput } from "@/components/search-input"
import { DateTimePicker } from "@/components/datetime-picker"
import { Select } from "@/components/ui/select"
import { WaitlistAssignmentCell } from "@/components/waitlist-assignment-cell"

interface AppointmentWithStatus extends Appointment {
  status: string
}

function formatDateTime(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getAppointmentStatus(appointmentTimeLocal: string) {
  const now = new Date()
  const appointmentDate = new Date(appointmentTimeLocal)
  const timeDiff = appointmentDate.getTime() - now.getTime()
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24))
  
  if (daysDiff < 0) {
    return <Badge variant="secondary" className="font-bold">Completed</Badge>
  } else if (daysDiff === 0) {
    return <Badge variant="destructive" className="font-bold">Today</Badge>
  } else if (daysDiff <= 7) {
    return <Badge variant="outline" className="border-orange-500 text-orange-600 font-bold">This Week</Badge>
  } else if (daysDiff <= 30) {
    return <Badge variant="outline" className="border-blue-500 text-blue-600 font-bold">This Month</Badge>
  } else {
    return <Badge variant="outline" className="border-green-500 text-green-600 font-bold">Future</Badge>
  }
}

// Sortable column header component for appointments
function SortableColumnHeader({
  children,
  field,
  orderBy,
  orderDir,
  onSort,
  className
}: {
  children: React.ReactNode
  field: string
  orderBy: string
  orderDir: string
  onSort: (field: string) => void
  className?: string
}) {
  const isActive = orderBy === field
  const currentDirection = isActive ? orderDir : 'none'
  
  const getSortIcon = () => {
    if (!isActive) return <ArrowUpDown className="h-4 w-4 opacity-50" />
    if (currentDirection === 'asc') return <ArrowUp className="h-4 w-4" />
    if (currentDirection === 'desc') return <ArrowDown className="h-4 w-4" />
    return <ArrowUpDown className="h-4 w-4 opacity-50" />
  }
  
  const getTooltipText = () => {
    if (!isActive) {
      return `Click to sort by ${children} (ascending)`
    }
    if (currentDirection === 'asc') {
      return `Currently sorting by ${children} (ascending). Click to sort descending`
    }
    if (currentDirection === 'desc') {
      return `Currently sorting by ${children} (descending). Click to sort ascending`
    }
    return `Click to sort by ${children}`
  }
  
  return (
    <TableHead
      className={`cursor-pointer select-none hover:bg-muted/50 transition-colors ${className || ''}`}
      onClick={() => onSort(field)}
      title={getTooltipText()}
    >
      <div className="flex items-center gap-1">
        {children}
        {getSortIcon()}
      </div>
    </TableHead>
  )
}

// Reusable filter section component for appointments
function AppointmentsFilterSection({ 
  appointmentIdTerm,
  waitlistIdTerm,
  startTime,
  endTime,
  selectedHospitalId,
  selectedDepartmentId,
  showOnlyOpen,
  hospitalOptions,
  departmentOptions,
  onAppointmentIdSearch,
  onWaitlistIdSearch,
  onStartTimeChange,
  onEndTimeChange,
  onHospitalChange,
  onDepartmentChange,
  onShowOnlyOpenChange
}: {
  appointmentIdTerm: string
  waitlistIdTerm: string
  startTime: string
  endTime: string
  selectedHospitalId: string
  selectedDepartmentId: string
  showOnlyOpen: boolean
  hospitalOptions: { value: string; label: string }[]
  departmentOptions: { value: string; label: string }[]
  onAppointmentIdSearch: (value: string) => void
  onWaitlistIdSearch: (value: string) => void
  onStartTimeChange: (value: string) => void
  onEndTimeChange: (value: string) => void
  onHospitalChange: (value: string) => void
  onDepartmentChange: (value: string) => void
  onShowOnlyOpenChange: (checked: boolean) => void
}) {
  return (
    <div className="bg-muted/5 p-6 rounded-lg border space-y-6">
      {/* Search Fields Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <SearchInput
          label="Search by Appointment ID"
          placeholder="Enter appointment ID..."
          onSearch={onAppointmentIdSearch}
          debounceMs={300}
          className="w-full"
          value={appointmentIdTerm}
        />
        <SearchInput
          label="Search by Waitlist ID"
          placeholder="Enter waitlist ID..."
          onSearch={onWaitlistIdSearch}
          debounceMs={300}
          className="w-full"
          value={waitlistIdTerm}
        />
        <Select
          label="Hospital"
          value={selectedHospitalId}
          onChange={onHospitalChange}
          options={hospitalOptions}
          placeholder="Select hospital..."
          emptyLabel="All Hospitals"
          className="w-full"
        />
      </div>
      
      {/* Date Time & Department Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <DateTimePicker
          label="From Date & Time"
          value={startTime}
          onChange={onStartTimeChange}
          placeholder="Start date and time"
          className="w-full"
        />
        <DateTimePicker
          label="To Date & Time"
          value={endTime}
          onChange={onEndTimeChange}
          placeholder="End date and time"
          className="w-full"
        />
        <Select
          label="Department"
          value={selectedDepartmentId}
          onChange={onDepartmentChange}
          options={departmentOptions}
          placeholder="Select department..."
          emptyLabel="All Departments"
          className="w-full"
        />
      </div>
      
      {/* Checkbox Row */}
      <div className="grid grid-cols-1 gap-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="show-only-open"
            checked={showOnlyOpen}
            onCheckedChange={onShowOnlyOpenChange}
          />
          <label
            htmlFor="show-only-open"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Only show open appointments
          </label>
        </div>
      </div>
    </div>
  )
}

export function AppointmentsTable() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isMobile = useIsMobile()
  
  const [isLoaded, setIsLoaded] = useState(false)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [paginationData, setPaginationData] = useState<{
    total: number
    page: number
    total_pages: number
    has_next: boolean
    has_prev: boolean
  }>({ total: 0, page: 1, total_pages: 0, has_next: false, has_prev: false })
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithStatus | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedAppointments, setSelectedAppointments] = useState<Set<string>>(new Set())
  const [isAssigningSelected, setIsAssigningSelected] = useState(false)
  const [assignmentResult, setAssignmentResult] = useState<AssignmentResult | null>(null)
  const [assignmentType, setAssignmentType] = useState<"auto-assign" | "assign-selected" | null>(null)
  const [isResultModalOpen, setIsResultModalOpen] = useState(false)
  const [isAddAppointmentModalOpen, setIsAddAppointmentModalOpen] = useState(false)
  
  // Get filter values from URL parameters
  const appointmentIdTerm = searchParams.get('appointment_id') || ''
  const waitlistIdTerm = searchParams.get('waitlist_id') || ''
  const startTime = searchParams.get('start_time') || ''
  const endTime = searchParams.get('end_time') || ''
  const selectedHospitalId = searchParams.get('hospital_id') || ''
  const selectedDepartmentId = searchParams.get('department_id') || ''
  const showOnlyOpen = searchParams.get('status') === '1'
  const currentPage = parseInt(searchParams.get('page') || '1')
  
  // Get sorting parameters from URL
  const orderBy = searchParams.get('order_by') || ''
  const orderDir = searchParams.get('order_dir') || 'asc'
  
  const { getDepartmentName, departments } = useDepartments()
  const { getHospitalName, hospitals } = useHospitals()

  // Helper function to update URL parameters
  const updateUrlParams = useCallback((updates: Record<string, string>) => {
    const newSearchParams = new URLSearchParams(searchParams)
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        newSearchParams.set(key, value)
      } else {
        newSearchParams.delete(key)
      }
    })
    
    router.push(`/appointments?${newSearchParams.toString()}`, { scroll: false })
  }, [router, searchParams])

  // Convert data to select options and sort alphabetically
  const hospitalOptions = hospitals
    .map(hospital => ({
      value: hospital.hospital_id,
      label: hospital.hospital_name
    }))
    .sort((a, b) => a.label.localeCompare(b.label))

  const departmentOptions = departments
    .map(department => ({
      value: department.department_id,
      label: department.department_name
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
  
  const handleAppointmentClick = useCallback((appointment: Appointment) => {
    // Add status based on appointment time and ensure waitlist_id is string
    const appointmentWithStatus: AppointmentWithStatus = {
      ...appointment,
      waitlist_id: appointment.waitlist_id || '',
      status: getStatusFromAppointmentTime(appointment.appointment_time)
    }
    setSelectedAppointment(appointmentWithStatus)
    setIsModalOpen(true)
  }, [])

  const loadAppointments = useCallback(async (filters?: {
    appointmentId?: string
    waitlistId?: string
    startTime?: string
    endTime?: string
    hospitalId?: string
    departmentId?: string
    status?: string
    orderBy?: string
    orderDir?: string
    page?: number
  }, isManualRefresh = false) => {
    try {
      setError(null)
      if (isManualRefresh) {
        setIsRefreshing(true)
      } else {
        setIsLoaded(false)
      }
      const response = await fetchAppointments(filters)
      setAppointments(response.results)
      setPaginationData({
        total: response.total,
        page: response.page,
        total_pages: response.total_pages,
        has_next: response.has_next,
        has_prev: response.has_prev
      })
      setSelectedAppointments(new Set())
      
      // Handle URL-based modal opening after data is loaded
      if (waitlistIdTerm && globalUrlModalHandled !== waitlistIdTerm) {
        const appointment = response.results.find(a => a.waitlist_id === waitlistIdTerm)
        if (appointment) {
          handleAppointmentClick(appointment)
          globalUrlModalHandled = waitlistIdTerm
        }
      }
      
      if (appointmentIdTerm && globalUrlModalHandled !== appointmentIdTerm) {
        const appointment = response.results.find(a => a.appointment_id === appointmentIdTerm)
        if (appointment) {
          handleAppointmentClick(appointment)
          globalUrlModalHandled = appointmentIdTerm
        }
      }
      
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Failed to load appointments:', err)
      setError('Failed to load appointments')
      setAppointments([])
      setPaginationData({ total: 0, page: 1, total_pages: 0, has_next: false, has_prev: false })
    } finally {
      setIsLoaded(true)
      setIsRefreshing(false)
    }
  }, [waitlistIdTerm, appointmentIdTerm, handleAppointmentClick])

  // Load appointments when URL parameters change
  useEffect(() => {
    const filters = {
      appointmentId: appointmentIdTerm.trim() || undefined,
      waitlistId: waitlistIdTerm.trim() || undefined,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      hospitalId: selectedHospitalId || undefined,
      departmentId: selectedDepartmentId || undefined,
      status: showOnlyOpen ? '1' : undefined,
      orderBy: orderBy || undefined,
      orderDir: orderDir === 'desc' ? 'desc' : 'asc',
      page: currentPage
    }
    loadAppointments(filters)
  }, [loadAppointments, appointmentIdTerm, waitlistIdTerm, startTime, endTime, selectedHospitalId, selectedDepartmentId, showOnlyOpen, orderBy, orderDir, currentPage])

  const handleAppointmentIdSearch = useCallback((value: string) => {
    const trimmedValue = value.trim()
    // Only reset page if the value is actually different from current URL
    if (trimmedValue !== appointmentIdTerm) {
      updateUrlParams({ appointment_id: trimmedValue, page: '1' })
    }
  }, [updateUrlParams, appointmentIdTerm])

  const handleWaitlistIdSearch = useCallback((value: string) => {
    const trimmedValue = value.trim()
    // Only reset page if the value is actually different from current URL
    if (trimmedValue !== waitlistIdTerm) {
      updateUrlParams({ waitlist_id: trimmedValue, page: '1' })
    }
  }, [updateUrlParams, waitlistIdTerm])

  const handleStartTimeChange = useCallback((value: string) => {
    // Only reset page if the value is actually different from current URL
    if (value !== startTime) {
      updateUrlParams({ start_time: value, page: '1' })
    }
  }, [updateUrlParams, startTime])

  const handleEndTimeChange = useCallback((value: string) => {
    // Only reset page if the value is actually different from current URL
    if (value !== endTime) {
      updateUrlParams({ end_time: value, page: '1' })
    }
  }, [updateUrlParams, endTime])

  const handleHospitalChange = useCallback((value: string) => {
    // Only reset page if the value is actually different from current URL
    if (value !== selectedHospitalId) {
      updateUrlParams({ hospital_id: value, page: '1' })
    }
  }, [updateUrlParams, selectedHospitalId])

  const handleDepartmentChange = useCallback((value: string) => {
    // Only reset page if the value is actually different from current URL
    if (value !== selectedDepartmentId) {
      updateUrlParams({ department_id: value, page: '1' })
    }
  }, [updateUrlParams, selectedDepartmentId])

  const handleShowOnlyOpenChange = useCallback((checked: boolean) => {
    // Only reset page if the value is actually different from current state
    const newValue = checked ? '1' : ''
    const currentValue = showOnlyOpen ? '1' : ''
    if (newValue !== currentValue) {
      updateUrlParams({ status: newValue, page: '1' })
    }
  }, [updateUrlParams, showOnlyOpen])

  const handlePageChange = useCallback((page: number) => {
    updateUrlParams({ page: page.toString() })
  }, [updateUrlParams])

  const handleSort = useCallback((field: string) => {
    let newOrderDir = 'asc'
    
    // If clicking the same field, toggle direction
    if (orderBy === field) {
      newOrderDir = orderDir === 'asc' ? 'desc' : 'asc'
    }
    
    updateUrlParams({ 
      order_by: field, 
      order_dir: newOrderDir,
      page: '1' // Reset to first page when sorting
    })
  }, [orderBy, orderDir, updateUrlParams])

  const handleRefresh = useCallback(() => {
    const filters = {
      appointmentId: appointmentIdTerm.trim() || undefined,
      waitlistId: waitlistIdTerm.trim() || undefined,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      hospitalId: selectedHospitalId || undefined,
      departmentId: selectedDepartmentId || undefined,
      status: showOnlyOpen ? '1' : undefined,
      orderBy: orderBy || undefined,
      orderDir: orderDir === 'desc' ? 'desc' : 'asc',
      page: currentPage
    }
    loadAppointments(filters, true)
  }, [loadAppointments, appointmentIdTerm, waitlistIdTerm, startTime, endTime, selectedHospitalId, selectedDepartmentId, showOnlyOpen, orderBy, orderDir, currentPage])


  const handleAssignSelected = useCallback(async () => {
    try {
      setIsAssigningSelected(true)
      const appointmentIds = Array.from(selectedAppointments)
      const result = await assignSelectedAppointments(appointmentIds)
      setAssignmentResult(result)
      setAssignmentType("assign-selected")
      setIsResultModalOpen(true)
    } catch (error) {
      console.error('Failed to assign selected appointments:', error)
    } finally {
      setIsAssigningSelected(false)
    }
  }, [selectedAppointments])

  const handleSelectAppointment = useCallback((appointmentId: string, checked: boolean) => {
    setSelectedAppointments(prev => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(appointmentId)
      } else {
        newSet.delete(appointmentId)
      }
      return newSet
    })
  }, [])

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      const selectableAppointments = appointments
        .filter(apt => apt.waitlist_id === null)
        .map(apt => apt.appointment_id)
      setSelectedAppointments(new Set(selectableAppointments))
    } else {
      setSelectedAppointments(new Set())
    }
  }, [appointments])

  const selectableAppointments = appointments.filter(apt => apt.waitlist_id === null)
  const isAllSelected = selectableAppointments.length > 0 && selectedAppointments.size === selectableAppointments.length
  const isSomeSelected = selectedAppointments.size > 0 && selectedAppointments.size < selectableAppointments.length

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


  const handleCloseModal = (shouldRefresh = false, assignmentData?: { success: boolean; waitlist_id?: string }) => {
    setIsModalOpen(false)
    setSelectedAppointment(null)
    if (shouldRefresh) {
      handleRefresh()
    }
    
    // If assignment was successful and we have a waitlist_id, reopen the modal with updated appointment
    if (assignmentData?.success && assignmentData.waitlist_id && selectedAppointment) {
      // Small delay to allow the refresh to complete and modal to close
      setTimeout(() => {
        const updatedAppointment = {
          ...selectedAppointment,
          waitlist_id: assignmentData.waitlist_id || ''
        }
        setSelectedAppointment(updatedAppointment)
        setIsModalOpen(true)
      }, 100)
    }
  }

  const handleCloseResultModal = () => {
    setIsResultModalOpen(false)
    setAssignmentResult(null)
    setAssignmentType(null)
    handleRefresh()
  }

  const getStatusFromAppointmentTime = (appointmentTimeLocal: string): string => {
    const now = new Date()
    const appointmentDate = new Date(appointmentTimeLocal)
    const timeDiff = appointmentDate.getTime() - now.getTime()
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24))
    
    if (daysDiff < -1) return 'completed'
    if (daysDiff < 0) return 'no-show'
    if (daysDiff === 0) return 'scheduled'
    return 'scheduled'
  }

  
  if (!isLoaded) {
    return <AppointmentsTableSkeleton />
  }

  // Show empty state if no appointments
  if (appointments.length === 0) {
      return (
    <div className="w-full space-y-4">
      {/* Search and Filter Section */}
      <div className="space-y-4">
        <AppointmentsFilterSection
          appointmentIdTerm={appointmentIdTerm}
          waitlistIdTerm={waitlistIdTerm}
          startTime={startTime}
          endTime={endTime}
          selectedHospitalId={selectedHospitalId}
          selectedDepartmentId={selectedDepartmentId}
          showOnlyOpen={showOnlyOpen}
          hospitalOptions={hospitalOptions}
          departmentOptions={departmentOptions}
          onAppointmentIdSearch={handleAppointmentIdSearch}
          onWaitlistIdSearch={handleWaitlistIdSearch}
          onStartTimeChange={handleStartTimeChange}
          onEndTimeChange={handleEndTimeChange}
          onHospitalChange={handleHospitalChange}
          onDepartmentChange={handleDepartmentChange}
          onShowOnlyOpenChange={handleShowOnlyOpenChange}
        />
        
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            No appointments found
            {appointmentIdTerm && ` matching appointment "${appointmentIdTerm}"`}
            {waitlistIdTerm && ` matching waitlist "${waitlistIdTerm}"`}
            {startTime && ` from ${new Date(startTime).toLocaleDateString()}`}
            {endTime && ` to ${new Date(endTime).toLocaleDateString()}`}
            {selectedHospitalId && ` at ${getHospitalName(selectedHospitalId)}`}
            {selectedDepartmentId && ` in ${getDepartmentName(selectedDepartmentId)}`}
            {showOnlyOpen && ` (open only)`}
          </div>
          {(appointmentIdTerm || waitlistIdTerm || startTime || endTime || selectedHospitalId || selectedDepartmentId || showOnlyOpen || orderBy) && (
            <button
              onClick={() => {
                router.push('/appointments', { scroll: false })
              }}
              className="text-sm text-primary hover:text-primary/80 font-medium cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Refresh Button */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <Button
              onClick={handleRefresh}
              disabled={isRefreshing}
              variant="outline"
              size="sm"
              className="self-start cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {lastUpdated && (
              <span className="text-xs text-muted-foreground mt-1">
                Updated at {formatLastUpdated(lastUpdated)}
              </span>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={() => setIsAddAppointmentModalOpen(true)}
              variant="default"
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Add Appointment
            </Button>
            <Button
              onClick={handleAssignSelected}
              disabled={isAssigningSelected || selectedAppointments.size === 0}
              variant="default"
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isAssigningSelected ? 'animate-spin' : ''}`} />
              Auto-Assign Selected ({selectedAppointments.size})
            </Button>
          </div>
        </div>
        </div>
        
        <div className="text-center py-12">
          <div className="text-lg font-medium text-muted-foreground mb-2">
            {(appointmentIdTerm || waitlistIdTerm || startTime || endTime || selectedHospitalId || selectedDepartmentId || orderBy) ? 'No matching appointments' : 'No upcoming appointments'}
          </div>
          <div className="text-sm text-muted-foreground">
            {error ? 'Unable to load appointments at this time.' : 
             (appointmentIdTerm || waitlistIdTerm || startTime || endTime || selectedHospitalId || selectedDepartmentId || orderBy) ? 'No appointments found with the selected filters.' : 
             'There are currently no scheduled appointments.'}
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="w-full space-y-4">
      {/* Search and Filter Section */}
      <div className="space-y-4">
        <AppointmentsFilterSection
          appointmentIdTerm={appointmentIdTerm}
          waitlistIdTerm={waitlistIdTerm}
          startTime={startTime}
          endTime={endTime}
          selectedHospitalId={selectedHospitalId}
          selectedDepartmentId={selectedDepartmentId}
          showOnlyOpen={showOnlyOpen}
          hospitalOptions={hospitalOptions}
          departmentOptions={departmentOptions}
          onAppointmentIdSearch={handleAppointmentIdSearch}
          onWaitlistIdSearch={handleWaitlistIdSearch}
          onStartTimeChange={handleStartTimeChange}
          onEndTimeChange={handleEndTimeChange}
          onHospitalChange={handleHospitalChange}
          onDepartmentChange={handleDepartmentChange}
          onShowOnlyOpenChange={handleShowOnlyOpenChange}
        />
        
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {paginationData.total > 0 
              ? `Found ${paginationData.total} appointment${paginationData.total === 1 ? '' : 's'} (page ${paginationData.page} of ${paginationData.total_pages})`
              : 'No appointments found'
            }
            {appointmentIdTerm && ` matching appointment "${appointmentIdTerm}"`}
            {waitlistIdTerm && ` matching waitlist "${waitlistIdTerm}"`}
            {startTime && ` from ${new Date(startTime).toLocaleDateString()}`}
            {endTime && ` to ${new Date(endTime).toLocaleDateString()}`}
            {selectedHospitalId && ` at ${getHospitalName(selectedHospitalId)}`}
            {selectedDepartmentId && ` in ${getDepartmentName(selectedDepartmentId)}`}
            {showOnlyOpen && ` (open only)`}
          </div>
          {(appointmentIdTerm || waitlistIdTerm || startTime || endTime || selectedHospitalId || selectedDepartmentId || showOnlyOpen || orderBy) && (
            <button
              onClick={() => {
                router.push('/appointments', { scroll: false })
              }}
              className="text-sm text-primary hover:text-primary/80 font-medium cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Refresh Button */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <Button
              onClick={handleRefresh}
              disabled={isRefreshing}
              variant="outline"
              size="sm"
              className="self-start cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {lastUpdated && (
              <span className="text-xs text-muted-foreground mt-1">
                Updated at {formatLastUpdated(lastUpdated)}
              </span>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={() => setIsAddAppointmentModalOpen(true)}
              variant="default"
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Add Appointment
            </Button>
            <Button
              onClick={handleAssignSelected}
              disabled={isAssigningSelected || selectedAppointments.size === 0}
              variant="default"
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isAssigningSelected ? 'animate-spin' : ''}`} />
              Auto-Assign Selected ({selectedAppointments.size})
            </Button>
          </div>
        </div>
      </div>

      {/* Conditionally render mobile or desktop view */}
      {isMobile ? (
        /* Mobile Card View */
        <div className="space-y-4">
          {appointments.map((appointment) => (
          <Card 
            key={appointment.appointment_id} 
            className="p-4 gap-2 cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => handleAppointmentClick(appointment)}
          >
            <div className="flex justify-between items-start">
              <div className="flex items-start gap-3">
                {appointment.waitlist_id === null && (
                  <Checkbox
                    checked={selectedAppointments.has(appointment.appointment_id)}
                    onCheckedChange={(checked) => handleSelectAppointment(appointment.appointment_id, checked as boolean)}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                <div>
                  <div className="font-mono text-sm font-medium pb-2">
                    {appointment.appointment_id}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatDateTime(appointment.appointment_time)}
                  </div>
                </div>
              </div>
              {getAppointmentStatus(appointment.appointment_time)}
            </div>
            
            <div className="space-y-1">
              <div className="flex flex-wrap gap-2 pb-2">
                <Badge variant="outline">{getDepartmentName(appointment.department_id)}</Badge>
                <Badge variant="secondary">{getHospitalName(appointment.hospital_id)}</Badge>
              </div>
              
              <div className="text-sm">
                <div className="font-medium text-xs">Waitlist ID:</div>
                <div className="text-muted-foreground">
                  <WaitlistAssignmentCell 
                    waitlistId={appointment.waitlist_id}
                    assignAt={appointment.assign_at}
                  />
                </div>
              </div>
            </div>
          </Card>
          ))}
        </div>
      ) : (
        /* Desktop Table View */
        <div className="w-full overflow-x-auto rounded-lg border shadow-sm">
        <Table className="min-w-[1200px]">
          <TableHeader>
            <TableRow className="bg-muted/30 border-b-2 border-border hover:bg-muted/30">
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isSomeSelected}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="w-[140px]">Appointment ID</TableHead>
              <SortableColumnHeader 
                field="appointment_time" 
                orderBy={orderBy} 
                orderDir={orderDir} 
                onSort={handleSort}
                className="w-[160px]"
              >
                Appointment Time
              </SortableColumnHeader>
              <TableHead className="w-[140px]">Waitlist ID</TableHead>
              <TableHead className="w-[120px]">Department</TableHead>
              <TableHead className="w-[120px]">Hospital</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {appointments.map((appointment, index) => (
              <TableRow 
                key={appointment.appointment_id}
                className={`cursor-pointer hover:bg-accent/70 transition-colors border-b border-border/50 ${
                  index % 2 === 0 ? 'bg-muted/20' : 'bg-background'
                }`}
              >
                <TableCell>
                  {appointment.waitlist_id === null ? (
                    <Checkbox
                      checked={selectedAppointments.has(appointment.appointment_id)}
                      onCheckedChange={(checked) => handleSelectAppointment(appointment.appointment_id, checked as boolean)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div className="w-4 h-4" />
                  )}
                </TableCell>
                <TableCell 
                  className="font-mono text-sm cursor-pointer"
                  onClick={() => handleAppointmentClick(appointment)}
                >
                  {appointment.appointment_id.slice(0, 8)}...
                </TableCell>
                <TableCell 
                  className="cursor-pointer"
                  onClick={() => handleAppointmentClick(appointment)}
                >
                  {formatDateTime(appointment.appointment_time)}
                </TableCell>
                <TableCell 
                  className="cursor-pointer font-mono text-sm"
                  onClick={() => handleAppointmentClick(appointment)}
                >
                  <div className="max-w-[120px] overflow-hidden">
                    {appointment.waitlist_id ? (
                      <span className="truncate block" title={appointment.waitlist_id}>
                        {appointment.waitlist_id.length > 12 ? `${appointment.waitlist_id.slice(0, 12)}...` : appointment.waitlist_id}
                      </span>
                    ) : (
                      <WaitlistAssignmentCell 
                        waitlistId={appointment.waitlist_id}
                        assignAt={appointment.assign_at}
                        compact={true}
                      />
                    )}
                  </div>
                </TableCell>
                <TableCell 
                  className="cursor-pointer"
                  onClick={() => handleAppointmentClick(appointment)}
                >
                  <Badge variant="outline">{getDepartmentName(appointment.department_id)}</Badge>
                </TableCell>
                <TableCell 
                  className="cursor-pointer"
                  onClick={() => handleAppointmentClick(appointment)}
                >
                  <Badge variant="secondary">{getHospitalName(appointment.hospital_id)}</Badge>
                </TableCell>
                <TableCell 
                  className="cursor-pointer"
                  onClick={() => handleAppointmentClick(appointment)}
                >
                  {getAppointmentStatus(appointment.appointment_time)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      )}

      <AppointmentModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        appointment={selectedAppointment ? {
          appointment_id: selectedAppointment.appointment_id,
          appointment_time: selectedAppointment.appointment_time,
          waitlist_id: selectedAppointment.waitlist_id || '',
          department_id: selectedAppointment.department_id,
          hospital_id: selectedAppointment.hospital_id,
          status: selectedAppointment.status,
          properties: selectedAppointment.properties,
          assign_at: selectedAppointment.assign_at
        } : null}
      />
      
      <TablePagination
        currentPage={paginationData.page}
        totalPages={paginationData.total_pages}
        hasNext={paginationData.has_next}
        hasPrev={paginationData.has_prev}
        onPageChange={handlePageChange}
      />

      <AssignmentResultsModal
        isOpen={isResultModalOpen}
        onClose={handleCloseResultModal}
        result={assignmentResult}
        type={assignmentType || "auto-assign"}
      />

      <AddAppointmentModal
        isOpen={isAddAppointmentModalOpen}
        onClose={(shouldRefresh) => {
          setIsAddAppointmentModalOpen(false)
          if (shouldRefresh) {
            handleRefresh()
          }
        }}
      />
    </div>
  )
} 