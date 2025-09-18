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
import { PatientModal } from "@/components/patient-modal"
import { AddPatientModal } from "@/components/add-patient-modal"
import { WaitlistTableSkeleton } from "@/components/waitlist-table-skeleton"
import { useDepartments } from "@/hooks/use-reference-data"
import { fetchPatients, Patient } from "@/lib/api"
import { TablePagination } from "@/components/table-pagination"
import { useEffect, useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useIsMobile } from "@/hooks/use-mobile"
import { RefreshCw, Loader2, UserPlus, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SearchInput } from "@/components/search-input"
import { DatePicker } from "@/components/ui/date-picker"
import { Select } from "@/components/ui/select"
import { NumberInput } from "@/components/ui/number-input"

const URGENCY_SEVERITY_OPTIONS = [
  { value: '1', label: 'Low' },
  { value: '2', label: 'Medium' },
  { value: '3', label: 'High' }
]

const GRADING_STATUS_OPTIONS = [
  { value: 'graded', label: 'Graded' },
  { value: 'ungraded', label: 'Ungraded' }
]

const ASSIGNMENT_STATUS_OPTIONS = [
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'assigned', label: 'Assigned' }
]

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}


// Color coding for integer severity levels (1=Low, 2=Medium, 3=High)
function getIntegerSeverityColor(value: 1 | 2 | 3 | null) {
  if (value === null) return 'text-muted-foreground'
  if (value === 3) return 'text-red-600'
  if (value === 2) return 'text-amber-600'
  return 'text-green-600'
}

// Color coding for float comorbidities (0-1)
function getFloatSeverityColor(value: number | null) {
  if (value === null) return 'text-muted-foreground'
  if (value >= 0.7) return 'text-red-600'
  if (value >= 0.4) return 'text-amber-600'
  return 'text-green-600'
}

// Convert integer severity to label
function getSeverityLabel(value: 1 | 2 | 3 | null) {
  if (value === null) return 'N/A'
  if (value === 3) return 'High'
  if (value === 2) return 'Medium'
  return 'Low'
}

// Get grading status display for table cells
function getGradingStatusCell<T>(status: 'GRADING' | 'COMPLETED' | 'FAILED' | null, value: T, formatter: (val: T) => React.ReactElement) {
  if (status === 'GRADING') return <Loader2 className="h-4 w-4 animate-spin mx-auto" />
  if (status === 'FAILED') return <span className="text-red-600 text-sm">Failed</span>
  return formatter(value)
}

function getClinicalUrgencyLabel(value: string) {
  if (value === '1') return 'Low'
  if (value === '2') return 'Medium'
  if (value === '3') return 'High'
  return 'All Urgencies'
}

function getConditionSeverityLabel(value: string) {
  if (value === '1') return 'Low'
  if (value === '2') return 'Medium'
  if (value === '3') return 'High'
  return 'All Severities'
}

// Helper function to check if filters are active
function hasActiveFilters(waitlistId: string, medicalNumber: string, postcode: string, minClinicalUrgency: string, minConditionSeverity: string, minComorbidities: string, minReferralDate: string, maxReferralDate: string, selectedDepartmentId: string, gradingStatus: string, assignmentStatus: string, orderBy: string = '') {
  return !!(waitlistId || medicalNumber || postcode || minClinicalUrgency || minConditionSeverity || minComorbidities || minReferralDate || maxReferralDate || selectedDepartmentId || gradingStatus || assignmentStatus || orderBy)
}

// Helper function to build filter object
function buildFilters(waitlistId: string, medicalNumber: string, postcode: string, minClinicalUrgency: string, minConditionSeverity: string, minComorbidities: string, minReferralDate: string, maxReferralDate: string, selectedDepartmentId: string, gradingStatus: string, assignmentStatus: string, orderBy: string, orderDir: string, page: number = 1) {
  let gradingStatusValue: number | undefined
  if (gradingStatus === 'graded') {
    gradingStatusValue = 0
  } else if (gradingStatus === 'ungraded') {
    gradingStatusValue = 1
  }
  
  let assignmentStatusValue: number | undefined
  if (assignmentStatus === 'unassigned') {
    assignmentStatusValue = 0
  } else if (assignmentStatus === 'assigned') {
    assignmentStatusValue = 1
  }
  
  return {
    waitlistId: waitlistId.trim() || undefined,
    medicalNumber: medicalNumber.trim() || undefined,
    postcode: postcode.trim() || undefined,
    minClinicalUrgency: minClinicalUrgency ? parseInt(minClinicalUrgency) : undefined,
    minConditionSeverity: minConditionSeverity ? parseInt(minConditionSeverity) : undefined,
    minComorbidities: minComorbidities ? parseFloat(minComorbidities) : undefined,
    minReferralDate: minReferralDate || undefined,
    maxReferralDate: maxReferralDate || undefined,
    departmentId: selectedDepartmentId || undefined,
    gradingStatus: gradingStatusValue,
    assignmentStatus: assignmentStatusValue,
    orderBy: orderBy || undefined,
    orderDir: orderDir === 'desc' ? 'desc' : 'asc',
    page
  }
}

// Sortable column header component
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

// Reusable filter section component
function FilterSection({ 
  medicalNumber, 
  postcode, 
  minClinicalUrgency, 
  minConditionSeverity, 
  minComorbidities, 
  minReferralDate, 
  maxReferralDate, 
  selectedDepartmentId,
  gradingStatus,
  assignmentStatus,
  departmentOptions,
  onMedicalNumberSearch,
  onPostcodeSearch,
  onClinicalUrgencyChange,
  onConditionSeverityChange,
  onComorbiditiesChange,
  onMinReferralDateChange,
  onMaxReferralDateChange,
  onDepartmentChange,
  onGradingStatusChange,
  onAssignmentStatusChange
}: {
  medicalNumber: string
  postcode: string
  minClinicalUrgency: string
  minConditionSeverity: string
  minComorbidities: string
  minReferralDate: string
  maxReferralDate: string
  selectedDepartmentId: string
  gradingStatus: string
  assignmentStatus: string
  departmentOptions: { value: string; label: string }[]
  onMedicalNumberSearch: (value: string) => void
  onPostcodeSearch: (value: string) => void
  onClinicalUrgencyChange: (value: string) => void
  onConditionSeverityChange: (value: string) => void
  onComorbiditiesChange: (value: string) => void
  onMinReferralDateChange: (value: string) => void
  onMaxReferralDateChange: (value: string) => void
  onDepartmentChange: (value: string) => void
  onGradingStatusChange: (value: string) => void
  onAssignmentStatusChange: (value: string) => void
}) {
  return (
    <div className="bg-muted/5 p-6 rounded-lg border space-y-6">
      {/* Search Fields Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <SearchInput
          label="Medical Number"
          placeholder="Enter Medical number..."
          onSearch={onMedicalNumberSearch}
          debounceMs={300}
          className="w-full"
          value={medicalNumber}
        />
        <SearchInput
          label="Postcode"
          placeholder="Enter postcode..."
          onSearch={onPostcodeSearch}
          debounceMs={300}
          className="w-full"
          value={postcode}
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
      
      {/* Priority & Severity Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Select
          label="Clinical Urgency"
          value={minClinicalUrgency}
          onChange={onClinicalUrgencyChange}
          options={URGENCY_SEVERITY_OPTIONS}
          placeholder="Select urgency..."
          emptyLabel="All Urgencies"
          className="w-full"
        />
        <Select
          label="Condition Severity"
          value={minConditionSeverity}
          onChange={onConditionSeverityChange}
          options={URGENCY_SEVERITY_OPTIONS}
          placeholder="Select severity..."
          emptyLabel="All Severities"
          className="w-full"
        />
        <NumberInput
          label="Min. Comorbidities"
          value={minComorbidities}
          onChange={onComorbiditiesChange}
          placeholder="0.0"
          className="w-full"
          min={0}
          max={1}
          step={0.1}
        />
      </div>
      
      {/* Dates & Status Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <DatePicker
          label="Min. Referral Date"
          value={minReferralDate}
          onChange={onMinReferralDateChange}
          placeholder="Start date"
          className="w-full"
        />
        <DatePicker
          label="Max. Referral Date"
          value={maxReferralDate}
          onChange={onMaxReferralDateChange}
          placeholder="End date"
          className="w-full"
        />
        <Select
          label="Grading Status"
          value={gradingStatus}
          onChange={onGradingStatusChange}
          options={GRADING_STATUS_OPTIONS}
          placeholder="Select grading..."
          emptyLabel="All"
          className="w-full"
        />
        <Select
          label="Assignment Status"
          value={assignmentStatus}
          onChange={onAssignmentStatusChange}
          options={ASSIGNMENT_STATUS_OPTIONS}
          placeholder="Select assignment..."
          emptyLabel="All"
          className="w-full"
        />
      </div>
    </div>
  )
}

export function WaitlistTable() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isMobile = useIsMobile()
  
  const [isLoaded, setIsLoaded] = useState(false)
  const [patients, setPatients] = useState<Patient[]>([])
  const [paginationData, setPaginationData] = useState<{
    total: number
    page: number
    total_pages: number
    has_next: boolean
    has_prev: boolean
  }>({ total: 0, page: 1, total_pages: 0, has_next: false, has_prev: false })
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isAddPatientModalOpen, setIsAddPatientModalOpen] = useState(false)
  const [lastPatientUpdate, setLastPatientUpdate] = useState<{waitlistId: string, timestamp: number} | null>(null)
  
  // Get filter values from URL parameters
  const waitlistId = searchParams.get('waitlist_id') || ''
  const medicalNumber = searchParams.get('medical_number') || ''
  const postcode = searchParams.get('postcode') || ''
  const minClinicalUrgency = searchParams.get('min_clinical_urgency') || ''
  const minConditionSeverity = searchParams.get('min_condition_severity') || ''
  const minComorbidities = searchParams.get('min_comorbidities') || ''
  const minReferralDate = searchParams.get('min_referral_date') || ''
  const maxReferralDate = searchParams.get('max_referral_date') || ''
  const selectedDepartmentId = searchParams.get('department_id') || ''
  const gradingStatus = searchParams.get('grading_status') || ''
  const assignmentStatus = searchParams.get('assignment_status') || ''
  const currentPage = parseInt(searchParams.get('page') || '1')
  
  // Get sorting parameters from URL
  const orderBy = searchParams.get('order_by') || ''
  const orderDir = searchParams.get('order_dir') || 'asc'
  
  const { getDepartmentName, departments } = useDepartments()
  

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
    
    router.push(`/waitlist?${newSearchParams.toString()}`, { scroll: false })
  }, [router, searchParams])

  // Convert departments to select options and sort alphabetically
  const departmentOptions = departments
    .map(department => ({
      value: department.department_id,
      label: department.department_name
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
  
  const handlePatientClick = useCallback((patient: Patient) => {
    setSelectedPatient(patient)
    setIsModalOpen(true)
  }, [])

  const loadPatients = useCallback(async (filters?: {
    waitlistId?: string
    medicalNumber?: string
    postcode?: string
    minClinicalUrgency?: number
    minConditionSeverity?: number
    minComorbidities?: number
    minReferralDate?: string
    maxReferralDate?: string
    departmentId?: string
    gradingStatus?: number
    assignmentStatus?: number
    page?: number
  }, isManualRefresh = false) => {
    try {
      setError(null)
      if (isManualRefresh) {
        setIsRefreshing(true)
      } else {
        setIsLoaded(false)
      }
      const response = await fetchPatients(filters)
      setPatients(response.results)
      setPaginationData({
        total: response.total,
        page: response.page,
        total_pages: response.total_pages,
        has_next: response.has_next,
        has_prev: response.has_prev
      })
      
      // Handle URL-based modal opening after data is loaded
      if (waitlistId && globalUrlModalHandled !== waitlistId) {
        const patient = response.results.find(p => p.waitlist_id === waitlistId)
        if (patient) {
          handlePatientClick(patient)
          globalUrlModalHandled = waitlistId
        }
      }
      
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Failed to load patients:', err)
      setError('Failed to load patients')
      setPatients([])
      setPaginationData({ total: 0, page: 1, total_pages: 0, has_next: false, has_prev: false })
    } finally {
      setIsLoaded(true)
      setIsRefreshing(false)
    }
  }, [waitlistId, handlePatientClick])

  // Load patients when URL parameters change
  useEffect(() => {
    const filters = buildFilters(waitlistId, medicalNumber, postcode, minClinicalUrgency, minConditionSeverity, minComorbidities, minReferralDate, maxReferralDate, selectedDepartmentId, gradingStatus, assignmentStatus, orderBy, orderDir, currentPage)
    loadPatients(filters)
  }, [waitlistId, medicalNumber, postcode, minClinicalUrgency, minConditionSeverity, minComorbidities, minReferralDate, maxReferralDate, selectedDepartmentId, gradingStatus, assignmentStatus, orderBy, orderDir, currentPage, loadPatients])


  const handleMedicalNumberSearch = useCallback((value: string) => {
    const trimmedValue = value.trim()
    // Only reset page if the value is actually different from current URL
    if (trimmedValue !== medicalNumber) {
      updateUrlParams({ medical_number: trimmedValue, page: '1' })
    }
  }, [updateUrlParams, medicalNumber])

  const handlePostcodeSearch = useCallback((value: string) => {
    const trimmedValue = value.trim()
    // Only reset page if the value is actually different from current URL
    if (trimmedValue !== postcode) {
      updateUrlParams({ postcode: trimmedValue, page: '1' })
    }
  }, [updateUrlParams, postcode])

  const handleClinicalUrgencyChange = useCallback((value: string) => {
    // Only reset page if the value is actually different from current URL
    if (value !== minClinicalUrgency) {
      updateUrlParams({ 
        min_clinical_urgency: value,
        max_clinical_urgency: value,
        page: '1'
      })
    }
  }, [updateUrlParams, minClinicalUrgency])

  const handleConditionSeverityChange = useCallback((value: string) => {
    // Only reset page if the value is actually different from current URL
    if (value !== minConditionSeverity) {
      updateUrlParams({ 
        min_condition_severity: value,
        max_condition_severity: value,
        page: '1'
      })
    }
  }, [updateUrlParams, minConditionSeverity])

  const handleComorbiditiesChange = useCallback((value: string) => {
    // Only reset page if the value is actually different from current URL
    if (value !== minComorbidities) {
      updateUrlParams({ 
        min_comorbidities: value,
        max_comorbidities: value,
        page: '1'
      })
    }
  }, [updateUrlParams, minComorbidities])

  const handleMinReferralDateChange = useCallback((value: string) => {
    // Only reset page if the value is actually different from current URL
    if (value !== minReferralDate) {
      updateUrlParams({ min_referral_date: value, page: '1' })
    }
  }, [updateUrlParams, minReferralDate])

  const handleMaxReferralDateChange = useCallback((value: string) => {
    // Only reset page if the value is actually different from current URL
    if (value !== maxReferralDate) {
      updateUrlParams({ max_referral_date: value, page: '1' })
    }
  }, [updateUrlParams, maxReferralDate])

  const handleDepartmentChange = useCallback((value: string) => {
    // Only reset page if the value is actually different from current URL
    if (value !== selectedDepartmentId) {
      updateUrlParams({ department_id: value, page: '1' })
    }
  }, [updateUrlParams, selectedDepartmentId])

  const handleGradingStatusChange = useCallback((value: string) => {
    // Only reset page if the value is actually different from current state
    if (value !== gradingStatus) {
      updateUrlParams({ grading_status: value, page: '1' })
    }
  }, [updateUrlParams, gradingStatus])

  const handleAssignmentStatusChange = useCallback((value: string) => {
    // Only reset page if the value is actually different from current state
    if (value !== assignmentStatus) {
      updateUrlParams({ assignment_status: value, page: '1' })
    }
  }, [updateUrlParams, assignmentStatus])

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
    const filters = buildFilters(waitlistId, medicalNumber, postcode, minClinicalUrgency, minConditionSeverity, minComorbidities, minReferralDate, maxReferralDate, selectedDepartmentId, gradingStatus, assignmentStatus, orderBy, orderDir, currentPage)
    loadPatients(filters, true)
  }, [loadPatients, waitlistId, medicalNumber, postcode, minClinicalUrgency, minConditionSeverity, minComorbidities, minReferralDate, maxReferralDate, selectedDepartmentId, gradingStatus, assignmentStatus, orderBy, orderDir, currentPage])


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


  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedPatient(null)
  }

  const handlePatientUpdate = (updatedPatientFromApi: Patient) => {
    // Create the new, updated list of patients based on the current state
    const newPatientsList = patients.map(p =>
      p.waitlist_id === updatedPatientFromApi.waitlist_id
        ? { ...p, ...updatedPatientFromApi }
        : p
    )
    
    // Find the updated patient object from our newly created list
    const updatedSelectedPatient = newPatientsList.find(
      p => p.waitlist_id === updatedPatientFromApi.waitlist_id
    )

    // Schedule both state updates. React will batch them into one render.
    setPatients(newPatientsList)
    
    if (updatedSelectedPatient) {
      setSelectedPatient(updatedSelectedPatient)
    }
  }

  // Clear old patient update tracking after some time
  useEffect(() => {
    if (!lastPatientUpdate) return
    
    const timer = setTimeout(() => {
      setLastPatientUpdate(null)
    }, 5000) // Clear after 5 seconds
    
    return () => clearTimeout(timer)
  }, [lastPatientUpdate])
  
  if (!isLoaded) {
    return <WaitlistTableSkeleton />
  }

  // Show empty state if no patients
  if (patients.length === 0) {
    return (
      <div className="w-full space-y-4">
        {/* Search and Filter Section */}
        <div className="space-y-4">
          <FilterSection
            medicalNumber={medicalNumber}
            postcode={postcode}
            minClinicalUrgency={minClinicalUrgency}
            minConditionSeverity={minConditionSeverity}
            minComorbidities={minComorbidities}
            minReferralDate={minReferralDate}
            maxReferralDate={maxReferralDate}
            selectedDepartmentId={selectedDepartmentId}
            gradingStatus={gradingStatus}
            assignmentStatus={assignmentStatus}
            departmentOptions={departmentOptions}
            onMedicalNumberSearch={handleMedicalNumberSearch}
            onPostcodeSearch={handlePostcodeSearch}
            onClinicalUrgencyChange={handleClinicalUrgencyChange}
            onConditionSeverityChange={handleConditionSeverityChange}
            onComorbiditiesChange={handleComorbiditiesChange}
            onMinReferralDateChange={handleMinReferralDateChange}
            onMaxReferralDateChange={handleMaxReferralDateChange}
            onDepartmentChange={handleDepartmentChange}
            onGradingStatusChange={handleGradingStatusChange}
            onAssignmentStatusChange={handleAssignmentStatusChange}
          />
          
          {hasActiveFilters(waitlistId, medicalNumber, postcode, minClinicalUrgency, minConditionSeverity, minComorbidities, minReferralDate, maxReferralDate, selectedDepartmentId, gradingStatus, assignmentStatus, orderBy) && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                No patients found
                {waitlistId && ` with waitlist ID "${waitlistId}"`}
                {medicalNumber && ` with Medical number "${medicalNumber}"`}
                {postcode && ` in postcode "${postcode}"`}
                {minClinicalUrgency && ` with clinical urgency ${getClinicalUrgencyLabel(minClinicalUrgency)}`}
                {minConditionSeverity && ` with condition severity ${getConditionSeverityLabel(minConditionSeverity)}`}
                {minComorbidities && ` with min comorbidities of ${minComorbidities}`}
                {minReferralDate && ` from ${new Date(minReferralDate).toLocaleDateString()}`}
                {maxReferralDate && ` to ${new Date(maxReferralDate).toLocaleDateString()}`}
                {selectedDepartmentId && ` in ${getDepartmentName(selectedDepartmentId)}`}
              </div>
              <button
                onClick={() => {
                  router.push('/waitlist', { scroll: false })
                }}
                className="text-sm text-primary hover:text-primary/80 font-medium cursor-pointer"
              >
                Clear filters
              </button>
            </div>
          )}

          {/* Refresh and Action Buttons */}
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
                onClick={() => setIsAddPatientModalOpen(true)}
                variant="default"
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 cursor-pointer"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add Patient
              </Button>
            </div>
          </div>
        </div>
        
        <div className="text-center py-12">
          <div className="text-lg font-medium text-muted-foreground mb-2">
            {hasActiveFilters(waitlistId, medicalNumber, postcode, minClinicalUrgency, minConditionSeverity, minComorbidities, minReferralDate, maxReferralDate, selectedDepartmentId, gradingStatus, assignmentStatus, orderBy) ? 'No matching patients' : 'No patients on the waitlist'}
          </div>
          <div className="text-sm text-muted-foreground">
            {error ? 'Unable to load patients at this time.' : 
             hasActiveFilters(waitlistId, medicalNumber, postcode, minClinicalUrgency, minConditionSeverity, minComorbidities, minReferralDate, maxReferralDate, selectedDepartmentId, gradingStatus, assignmentStatus, orderBy) ? 'No patients found with the selected filters.' : 
             'There are currently no patients on the waitlist.'}
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="w-full space-y-4">
      {/* Search and Filter Section */}
      <div className="space-y-4">
        <FilterSection
          medicalNumber={medicalNumber}
          postcode={postcode}
          minClinicalUrgency={minClinicalUrgency}
          minConditionSeverity={minConditionSeverity}
          minComorbidities={minComorbidities}
          minReferralDate={minReferralDate}
          maxReferralDate={maxReferralDate}
          selectedDepartmentId={selectedDepartmentId}
          gradingStatus={gradingStatus}
          assignmentStatus={assignmentStatus}
          departmentOptions={departmentOptions}
          onMedicalNumberSearch={handleMedicalNumberSearch}
          onPostcodeSearch={handlePostcodeSearch}
          onClinicalUrgencyChange={handleClinicalUrgencyChange}
          onConditionSeverityChange={handleConditionSeverityChange}
          onComorbiditiesChange={handleComorbiditiesChange}
          onMinReferralDateChange={handleMinReferralDateChange}
          onMaxReferralDateChange={handleMaxReferralDateChange}
          onDepartmentChange={handleDepartmentChange}
          onGradingStatusChange={handleGradingStatusChange}
          onAssignmentStatusChange={handleAssignmentStatusChange}
        />
        
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {paginationData.total > 0 
              ? `Found ${paginationData.total} patient${paginationData.total === 1 ? '' : 's'} (page ${paginationData.page} of ${paginationData.total_pages})`
              : 'No patients found'
            }
            {waitlistId && ` with waitlist ID "${waitlistId}"`}
            {medicalNumber && ` with Medical number "${medicalNumber}"`}
            {postcode && ` in postcode "${postcode}"`}
            {minClinicalUrgency && ` with ${getClinicalUrgencyLabel(minClinicalUrgency)} clinical urgency`}
            {minConditionSeverity && ` with ${getConditionSeverityLabel(minConditionSeverity)} condition severity`}
            {minComorbidities && ` with min comorbidities of ${minComorbidities}`}
            {minReferralDate && ` from ${new Date(minReferralDate).toLocaleDateString()}`}
            {maxReferralDate && ` to ${new Date(maxReferralDate).toLocaleDateString()}`}
            {selectedDepartmentId && ` in ${getDepartmentName(selectedDepartmentId)}`}
            {gradingStatus === 'graded' && ` (graded only)`}
            {gradingStatus === 'ungraded' && ` (ungraded only)`}
            {assignmentStatus === 'assigned' && ` (assigned only)`}
            {assignmentStatus === 'unassigned' && ` (unassigned only)`}
          </div>
          {(waitlistId || medicalNumber || postcode || minClinicalUrgency || minConditionSeverity || minComorbidities || minReferralDate || maxReferralDate || selectedDepartmentId || gradingStatus || assignmentStatus || orderBy) && (
            <button
              onClick={() => {
                router.push('/waitlist', { scroll: false })
              }}
              className="text-sm text-primary hover:text-primary/80 font-medium cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Refresh and Action Buttons */}
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
              onClick={() => setIsAddPatientModalOpen(true)}
              variant="default"
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 cursor-pointer"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Patient
            </Button>
          </div>
        </div>
      </div>

      {/* Conditionally render mobile or desktop view */}
      {isMobile ? (
        /* Mobile Card View */
        <div className="space-y-4">
          {patients.map((patient) => (
            <Card 
              key={patient.waitlist_id} 
              className="p-4 gap-2 cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => handlePatientClick(patient)}
            >
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="font-mono text-sm font-medium">{patient.medical_number}</div>
                  <div className="text-xs text-muted-foreground">DOB: {formatDate(patient.date_of_birth)}</div>
                </div>
                <Badge variant="outline">{getDepartmentName(patient.department_id)}</Badge>
              </div>
              
              <div className="space-y-1">
                <div className="text-sm">
                  <div className="font-medium text-xs">Postcode:</div>
                  <div className="text-muted-foreground font-mono">
                    {patient.postcode}
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Urgency: </span>
                    {getGradingStatusCell(patient.grading_status, patient.clinical_urgency, (value) => 
                      <span className={`font-medium ${getIntegerSeverityColor(value)}`}>
                        {getSeverityLabel(value)}
                      </span>
                    )}
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Severity: </span>
                    {getGradingStatusCell(patient.grading_status, patient.condition_severity, (value) => 
                      <span className={`font-medium ${getIntegerSeverityColor(value)}`}>
                        {getSeverityLabel(value)}
                      </span>
                    )}
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Comorbidities: </span>
                    {getGradingStatusCell(patient.grading_status, patient.comorbidities, (value) => 
                      <span className={`font-medium ${getFloatSeverityColor(value)}`}>
                        {value !== null ? value.toFixed(2) : 'N/A'}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="text-sm">
                  <div className="font-medium text-xs">Referral:</div>
                  <div className="text-xs text-muted-foreground">{formatDate(patient.referral_date)}</div>
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
              <TableHead className="w-1/8">Medical Number</TableHead>
              <SortableColumnHeader 
                field="date_of_birth" 
                orderBy={orderBy} 
                orderDir={orderDir} 
                onSort={handleSort}
                className="w-1/8"
              >
                Date of Birth
              </SortableColumnHeader>
              <TableHead className="w-1/8">Postcode</TableHead>
              <TableHead className="w-1/8">Department</TableHead>
              <SortableColumnHeader 
                field="referral_date" 
                orderBy={orderBy} 
                orderDir={orderDir} 
                onSort={handleSort}
                className="w-1/8"
              >
                Referral Date
              </SortableColumnHeader>
              <SortableColumnHeader 
                field="clinical_urgency" 
                orderBy={orderBy} 
                orderDir={orderDir} 
                onSort={handleSort}
                className="w-1/8 text-center"
              >
                Clinical Urgency
              </SortableColumnHeader>
              <SortableColumnHeader 
                field="condition_severity" 
                orderBy={orderBy} 
                orderDir={orderDir} 
                onSort={handleSort}
                className="w-1/8 text-center"
              >
                Condition Severity
              </SortableColumnHeader>
              <SortableColumnHeader 
                field="comorbidities" 
                orderBy={orderBy} 
                orderDir={orderDir} 
                onSort={handleSort}
                className="w-1/8 text-center"
              >
                Comorbidities
              </SortableColumnHeader>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patients.map((patient, index) => (
              <TableRow 
                key={patient.waitlist_id}
                className={`cursor-pointer hover:bg-accent/70 transition-colors border-b border-border/50 ${
                  index % 2 === 0 ? 'bg-muted/20' : 'bg-background'
                }`}
                onClick={() => handlePatientClick(patient)}
              >
                <TableCell className="font-mono text-sm">
                  {patient.medical_number}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {formatDate(patient.date_of_birth)}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {patient.postcode}
                </TableCell>
                <TableCell className="text-sm">
                  <Badge variant="outline">{getDepartmentName(patient.department_id)}</Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {formatDate(patient.referral_date)}
                </TableCell>
                <TableCell className="text-center">
                  {getGradingStatusCell(patient.grading_status, patient.clinical_urgency, (value) => 
                    <div className={`text-sm font-medium ${getIntegerSeverityColor(value)}`}>
                      {getSeverityLabel(value)}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {getGradingStatusCell(patient.grading_status, patient.condition_severity, (value) => 
                    <div className={`text-sm font-medium ${getIntegerSeverityColor(value)}`}>
                      {getSeverityLabel(value)}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {getGradingStatusCell(patient.grading_status, patient.comorbidities, (value) => 
                    <div className={`text-sm font-medium ${getFloatSeverityColor(value)}`}>
                      {value !== null ? value.toFixed(2) : 'N/A'}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      )}

      <TablePagination
        currentPage={paginationData.page}
        totalPages={paginationData.total_pages}
        hasNext={paginationData.has_next}
        hasPrev={paginationData.has_prev}
        onPageChange={handlePageChange}
      />

      <PatientModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        patient={selectedPatient}
        onPatientUpdate={handlePatientUpdate}
      />

      <AddPatientModal
        isOpen={isAddPatientModalOpen}
        onClose={(shouldRefresh) => {
          setIsAddPatientModalOpen(false)
          if (shouldRefresh) {
            handleRefresh()
          }
        }}
        onPatientCreated={() => {
          // Just refresh the patients list - the modal transition is handled internally
          handleRefresh()
        }}
      />
    </div>
  )
} 