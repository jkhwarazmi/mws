"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar, Clock, MapPin, FileText, UserCheck, Loader2, ArrowLeft, XCircle, Bot, User, Search } from "lucide-react"
import { useDepartments, useHospitals } from "@/hooks/use-reference-data"
import { manualAssignAppointment, assignAppointmentToPatient, AssignmentPatient, AssignmentResponse, fetchWaitlistForManualAssignment, Patient } from "@/lib/api"
import { WaitlistAssignmentCell } from "@/components/waitlist-assignment-cell"
import { useCountdown } from "@/hooks/use-countdown"
import { TablePagination } from "@/components/table-pagination"
import Link from "next/link"
import { useState, useEffect } from "react"

interface AppointmentData {
  appointment_id: string
  appointment_time: string
  waitlist_id: string
  department_id: string
  hospital_id: string
  status: string
  properties: string[] | null
  assign_at?: string | null
}

interface AppointmentModalProps {
  isOpen: boolean
  onClose: (shouldRefresh?: boolean, assignmentData?: { success: boolean; waitlist_id?: string }) => void
  appointment: AppointmentData | null
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  })
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

function getStatusBadge(status: string, waitlistId: string) {
  // If waitlist_id exists, show as Assigned
  if (waitlistId && waitlistId !== '') {
    return <Badge variant="outline" className="border-green-500 text-green-600 bg-green-50 font-bold">Assigned</Badge>
  }
  
  switch (status.toLowerCase()) {
    case 'scheduled':
      return <Badge variant="default" className="font-bold">Scheduled</Badge>
    case 'completed':
      return <Badge variant="outline" className="border-green-500 text-green-600 font-bold">Completed</Badge>
    case 'cancelled':
      return <Badge variant="destructive" className="font-bold">Cancelled</Badge>
    case 'no-show':
      return <Badge variant="outline" className="border-red-500 text-red-600 font-bold">No Show</Badge>
    default:
      return <Badge variant="secondary" className="font-bold">{status}</Badge>
  }
}

type ModalPage = 'details' | 'loading' | 'result' | 'assigning' | 'success' | 'manual-loading' | 'manual-result'

// Color coding functions (copied from patient modal)
function getIntegerSeverityColor(value: 1 | 2 | 3 | null) {
  if (value === null) return 'text-muted-foreground'
  if (value === 3) return 'text-red-600'
  if (value === 2) return 'text-amber-600'
  return 'text-green-600'
}

function getFloatSeverityColor(value: number | null) {
  if (value === null) return 'text-muted-foreground'
  if (value >= 0.7) return 'text-red-600'
  if (value >= 0.4) return 'text-amber-600'
  return 'text-green-600'
}

function getSeverityLabel(value: 1 | 2 | 3 | null) {
  if (value === null) return 'N/A'
  if (value === 3) return 'High'
  if (value === 2) return 'Medium'
  return 'Low'
}

function convertSnakeCaseToTitle(snakeStr: string): string {
  return snakeStr
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export function AppointmentModal({ isOpen, onClose, appointment }: AppointmentModalProps) {
  const { getDepartmentName } = useDepartments()
  const { getHospitalName } = useHospitals()
  const [currentPage, setCurrentPage] = useState<ModalPage>('details')
  const [assignmentResult, setAssignmentResult] = useState<AssignmentPatient[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [assignmentResponse, setAssignmentResponse] = useState<AssignmentResponse | null>(null)
  
  // Manual assignment state
  const [manualAssignmentResult, setManualAssignmentResult] = useState<Patient[]>([])
  const [manualPaginationData, setManualPaginationData] = useState({
    page: 1,
    total_pages: 0,
    has_next: false,
    has_prev: false,
    total: 0
  })
  const [medicalNumberSearch, setMedicalNumberSearch] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [isPaginationLoading, setIsPaginationLoading] = useState(false)

  const countdown = useCountdown(appointment?.assign_at || null)
  
  // Reset modal state whenever it opens
  useEffect(() => {
    if (isOpen) {
      setCurrentPage('details')
      setAssignmentResult([])
      setSelectedPatientId(null)
      setAssignmentResponse(null)
      setManualAssignmentResult([])
      setManualPaginationData({
        page: 1,
        total_pages: 0,
        has_next: false,
        has_prev: false,
        total: 0
      })
      setMedicalNumberSearch('')
      setIsSearching(false)
      setIsPaginationLoading(false)
    }
  }, [isOpen])
  
  if (!appointment) return null

  const appointmentDate = new Date(appointment.appointment_time)
  const now = new Date()
  const isPast = appointmentDate < now
  const isToday = appointmentDate.toDateString() === now.toDateString()
  
  const hasWaitlistId = appointment.waitlist_id && appointment.waitlist_id !== ''
  const isAssigning = Boolean(countdown && countdown.total === 0)
  const aiButtonText = hasWaitlistId ? 'AI Reassignment' : 'AI Assignment'
  const aiButtonColorClass = 'bg-green-600 hover:bg-green-700'
  const manualButtonText = hasWaitlistId ? 'Manual Reassignment' : 'Manual Assignment'
  const manualButtonColorClass = 'bg-blue-600 hover:bg-blue-700'
  
  const handleAssignAppointment = async () => {
    setCurrentPage('loading')
    setAssignmentResult([])
    setSelectedPatientId(null)
    
    try {
      const result = await manualAssignAppointment(appointment.appointment_id)
      setAssignmentResult(result)
      setCurrentPage('result')
    } catch (error) {
      console.error('Failed to assign appointment:', error)
      setCurrentPage('details')
    }
  }

  const handleManualAssignment = async () => {
    setCurrentPage('manual-loading')
    setManualAssignmentResult([])
    setSelectedPatientId(null)
    
    try {
      const result = await fetchWaitlistForManualAssignment(appointment.department_id, 1, 5, medicalNumberSearch)
      setManualAssignmentResult(result.results)
      setManualPaginationData({
        page: result.page,
        total_pages: result.total_pages,
        has_next: result.has_next,
        has_prev: result.has_prev,
        total: result.total
      })
      setCurrentPage('manual-result')
    } catch (error) {
      console.error('Failed to fetch waitlist patients:', error)
      setCurrentPage('details')
    }
  }
  
  const handleManualPageChange = async (newPage: number) => {
    try {
      setIsPaginationLoading(true)
      const result = await fetchWaitlistForManualAssignment(appointment.department_id, newPage, 5, medicalNumberSearch)
      setManualAssignmentResult(result.results)
      setManualPaginationData({
        page: result.page,
        total_pages: result.total_pages,
        has_next: result.has_next,
        has_prev: result.has_prev,
        total: result.total
      })
      setSelectedPatientId(null) // Reset selection when changing pages
    } catch (error) {
      console.error('Failed to fetch waitlist patients:', error)
    } finally {
      setIsPaginationLoading(false)
    }
  }
  
  const handleMedicalNumberInputChange = (value: string) => {
    setMedicalNumberSearch(value)
  }

  const handleMedicalNumberSearch = async () => {
    setSelectedPatientId(null)
    setIsSearching(true)
    
    try {
      const result = await fetchWaitlistForManualAssignment(appointment.department_id, 1, 5, medicalNumberSearch)
      setManualAssignmentResult(result.results)
      setManualPaginationData({
        page: result.page,
        total_pages: result.total_pages,
        has_next: result.has_next,
        has_prev: result.has_prev,
        total: result.total
      })
    } catch (error) {
      console.error('Failed to search waitlist patients:', error)
    } finally {
      setIsSearching(false)
    }
  }
  
  const handleClose = (shouldRefresh = false, assignmentData?: { success: boolean; waitlist_id?: string }) => {
    setCurrentPage('details')
    setAssignmentResult([])
    setSelectedPatientId(null)
    setAssignmentResponse(null)
    onClose(shouldRefresh, assignmentData)
  }
  
  const handleBackToDetails = () => {
    setCurrentPage('details')
  }
  
  const handleAssignPatient = async () => {
    if (!selectedPatientId) return
    
    setCurrentPage('assigning')
    
    try {
      const response = await assignAppointmentToPatient(appointment.appointment_id, selectedPatientId, 'admin@medical.uk')
      setAssignmentResponse(response)
      setCurrentPage('success')
    } catch (error) {
      console.error('Failed to assign patient:', error)
      setAssignmentResponse({ error: 'Failed to assign appointment. Please try again.' })
      setCurrentPage('success')
    }
  }
  
  const handleSuccessClose = () => {
    const assignmentData = assignmentResponse?.success 
      ? { success: true, waitlist_id: assignmentResponse.waitlist_id }
      : undefined
    handleClose(true, assignmentData)
  }

  const renderDetailsPage = () => (
    <div className="space-y-6">
      {/* Assignment Buttons */}
      <div className="flex gap-3">
        <Button 
          onClick={handleAssignAppointment}
          disabled={isAssigning}
          className={`flex items-center gap-2 ${aiButtonColorClass} text-white w-fit cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <Bot className="h-4 w-4" />
          {aiButtonText}
        </Button>
        <Button 
          onClick={handleManualAssignment}
          disabled={isAssigning}
          className={`flex items-center gap-2 ${manualButtonColorClass} text-white w-fit cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <User className="h-4 w-4" />
          {manualButtonText}
        </Button>
      </div>

      {/* Assignment Countdown */}
      {!hasWaitlistId && appointment.assign_at && (
        <div className="flex justify-start">
          <WaitlistAssignmentCell 
            waitlistId={appointment.waitlist_id}
            assignAt={appointment.assign_at}
          />
        </div>
      )}
          
      {/* Appointment Status Header */}
      <Card className="border-l-4 border-l-primary">
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <span className="text-lg font-semibold">
                  {formatDate(appointment.appointment_time)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {formatTime(appointment.appointment_time)}
                </span>
              </div>
            </div>
            <div className="text-right space-y-2">
              {getStatusBadge(appointment.status, appointment.waitlist_id)}
              {isToday && (
                <div className="text-sm font-bold text-orange-600">Today</div>
              )}
              {isPast && !isToday && (
                <div className="text-sm font-bold text-muted-foreground">Past appointment</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Appointment Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Appointment ID</div>
              <div className="font-mono text-sm break-all">{appointment.appointment_id}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Full Date & Time</div>
              <div className="text-sm">{formatDateTime(appointment.appointment_time)}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Linked Waitlist Entry</div>
              {appointment.waitlist_id && appointment.waitlist_id !== '' ? (
                <Button 
                  onClick={() => {
                    window.open(`/waitlist?waitlist_id=${appointment.waitlist_id}`, '_blank')
                  }}
                  variant="outline"
                  className="flex items-center gap-2 w-fit cursor-pointer mt-2"
                  size="sm"
                  tabIndex={-1}
                >
                  <User className="h-4 w-4" />
                  View Patient
                </Button>
              ) : (
                <Badge variant="secondary">Unassigned Appointment</Badge>
              )}
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Status</div>
              <div>{getStatusBadge(appointment.status, appointment.waitlist_id)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Location Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Hospital</div>
              <div className="font-medium text-sm">{getHospitalName(appointment.hospital_id)}</div>
              <div className="text-sm text-muted-foreground">Hospital ID: {appointment.hospital_id}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Department</div>
              <div className="font-medium text-sm">{getDepartmentName(appointment.department_id)}</div>
              <div className="text-sm text-muted-foreground">Department ID: {appointment.department_id}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Properties */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Appointment Properties
          </CardTitle>
        </CardHeader>
        <CardContent>
          {appointment.properties && appointment.properties.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {appointment.properties.map((property, index) => (
                <Badge 
                  key={index} 
                  variant="secondary" 
                  className="text-sm px-3 py-1"
                >
                  {convertSnakeCaseToTitle(property)}
                </Badge>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground text-center">No properties</div>
          )}
        </CardContent>
      </Card>
    </div>
  )

  const renderLoadingPage = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <div className="text-lg font-medium">Fetching patient data...</div>
      <div className="text-sm text-muted-foreground">Please wait while we process your request</div>
    </div>
  )

  const renderAssigningPage = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <Loader2 className="h-12 w-12 animate-spin text-green-600" />
      <div className="text-lg font-medium">Assigning patient to appointment...</div>
      <div className="text-sm text-muted-foreground">Please wait while we complete the assignment</div>
    </div>
  )

  const renderSuccessPage = () => {
    const isSuccess = assignmentResponse?.success
    
    return (
      <div className="flex flex-col items-center justify-center pt-12 space-y-6">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
          isSuccess ? 'bg-green-100' : 'bg-red-100'
        }`}>
          {isSuccess ? (
            <UserCheck className="h-8 w-8 text-green-600" />
          ) : (
            <XCircle className="h-8 w-8 text-red-600" />
          )}
        </div>
        <div className="text-center space-y-2">
          <div className={`text-xl font-semibold ${
            isSuccess ? 'text-green-800' : 'text-red-800'
          }`}>
            {isSuccess ? 'Assignment Successful!' : 'Assignment Failed'}
          </div>
          <div className="text-sm text-muted-foreground">
            {isSuccess 
              ? 'The patient has been successfully assigned to this appointment.'
              : 'There was an issue processing the assignment. Please try again or contact support if the problem persists.'
            }
          </div>
          {assignmentResponse?.error && (
            <div className="text-xs text-red-600 mt-2">
              {assignmentResponse.error}
            </div>
          )}
        </div>
        <Button 
          onClick={handleSuccessClose}
          className={`cursor-pointer text-white ${
            isSuccess 
              ? 'bg-green-600 hover:bg-green-700' 
              : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          Close
        </Button>
      </div>
    )
  }

  const renderManualLoadingPage = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      <div className="text-lg font-medium">Loading waitlist patients...</div>
      <div className="text-sm text-muted-foreground">Please wait while we fetch patients from the waitlist</div>
    </div>
  )

  const renderManualResultPage = () => (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <Button 
          onClick={handleBackToDetails}
          variant="outline"
          className="flex items-center gap-2 cursor-pointer hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Details
        </Button>
        <Button 
          onClick={handleAssignPatient}
          disabled={!selectedPatientId}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <UserCheck className="h-4 w-4" />
          Assign
        </Button>
      </div>
      
      {/* Appointment Details Reminder */}
      <Card className="border-l-4 border-l-primary bg-blue-50/50 py-2">
        <CardContent className="px-4 py-2">
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground mb-2">Appointment Details:</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-sm font-medium">{formatDate(appointment.appointment_time)}</div>
                  <div className="text-xs text-muted-foreground">Date</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-sm font-medium">{formatTime(appointment.appointment_time)}</div>
                  <div className="text-xs text-muted-foreground">Time</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-sm font-medium">{getHospitalName(appointment.hospital_id)}</div>
                  <div className="text-xs text-muted-foreground">Hospital</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-sm font-medium">{getDepartmentName(appointment.department_id)}</div>
                  <div className="text-xs text-muted-foreground">Department</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Manual Assignment Results Header */}
      <div className="text-center">
        <div className="text-lg font-medium text-blue-700 mb-2">
          {manualPaginationData.total === 0 ? 'No Patients Found' : 'Waitlist Patients Available'}
        </div>
        <div className="text-sm text-muted-foreground">
          {manualPaginationData.total === 0 
            ? 'No unassigned patients found for this department'
            : `Select one patient to assign to this appointment (${manualPaginationData.total} patients total)`
          }
        </div>
      </div>
      
      {/* Search Bar if there are patients */}
      {manualPaginationData.total > 0 && (
        <div className="flex justify-center">
          <div className="w-full max-w-md space-y-2">
            <label className="text-sm font-medium text-gray-700">Search by Medical Number</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={medicalNumberSearch}
                onChange={(e) => handleMedicalNumberInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleMedicalNumberSearch()
                  }
                }}
                placeholder="Enter Medical number..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent h-10"
                disabled={isSearching}
              />
              <Button
                onClick={handleMedicalNumberSearch}
                disabled={isSearching}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 cursor-pointer disabled:opacity-50 h-10"
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Search
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Patient Cards */}
      {isSearching || isPaginationLoading ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <div className="text-sm text-muted-foreground">
            {isSearching ? 'Searching patients...' : 'Loading patients...'}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {manualAssignmentResult.map((patient) => (
          <Card 
            key={patient.waitlist_id} 
            className={`border-l-4 transition-all duration-200 cursor-pointer hover:shadow-md py-2 ${
              selectedPatientId === patient.waitlist_id 
                ? 'border-l-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-200' 
                : 'border-l-gray-300 hover:bg-gray-50 hover:border-l-gray-400'
            }`}
            onClick={() => setSelectedPatientId(
              selectedPatientId === patient.waitlist_id ? null : patient.waitlist_id
            )}
          >
            <CardContent className="px-6 py-2">
              <div className="flex items-start gap-4">
                <Checkbox
                  checked={selectedPatientId === patient.waitlist_id}
                  onCheckedChange={(checked) => {
                    setSelectedPatientId(checked ? patient.waitlist_id : null)
                  }}
                  className="mt-1.5"
                />
                
                <div className="flex-1 space-y-4">
                  {/* Patient Header */}
                  <div className="space-y-2">
                    <div className="font-mono text-base font-semibold text-gray-900">
                      {patient.waitlist_id}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Medical Number: </span>
                          <span className="font-mono font-medium">{patient.medical_number}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Date of Birth: </span>
                          <span className="font-medium">{formatDate(patient.date_of_birth)}</span>
                        </div>
                      </div>
                      <Link 
                        href={`/waitlist?waitlist_id=${patient.waitlist_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-white bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded transition-colors font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                  
                  {/* Clinical Assessment */}
                  <div className="border-t pt-4">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                      Clinical Assessment
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground mb-2">Clinical Urgency</div>
                        <div className={`text-base font-semibold ${getIntegerSeverityColor(patient.clinical_urgency)}`}>
                          {getSeverityLabel(patient.clinical_urgency)}
                        </div>
                      </div>
                      <div className="text-center border-l border-r border-gray-200 px-2">
                        <div className="text-xs text-muted-foreground mb-2">Condition Severity</div>
                        <div className={`text-base font-semibold ${getIntegerSeverityColor(patient.condition_severity)}`}>
                          {getSeverityLabel(patient.condition_severity)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground mb-2">Comorbidities</div>
                        <div className={`text-base font-semibold ${getFloatSeverityColor(patient.comorbidities)}`}>
                          {patient.comorbidities !== null ? patient.comorbidities.toFixed(2) : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Referral Notes */}
                  <div className="border-t pt-4">
                    <div className="text-xs font-medium text-muted-foreground mb-2">Referral Notes</div>
                    <div className="p-3 bg-muted rounded-md text-sm">
                      {patient.referral_notes}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        </div>
      )}
    </div>
  )

  const renderResultPage = () => (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <Button 
          onClick={handleBackToDetails}
          variant="outline"
          className="flex items-center gap-2 cursor-pointer hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Details
        </Button>
        <Button 
          onClick={handleAssignPatient}
          disabled={!selectedPatientId}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <UserCheck className="h-4 w-4" />
          Assign
        </Button>
      </div>
      
      {/* Appointment Details Reminder */}
      <Card className="border-l-4 border-l-primary bg-blue-50/50 py-2">
        <CardContent className="px-4 py-2">
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground mb-2">Appointment Details:</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-sm font-medium">{formatDate(appointment.appointment_time)}</div>
                  <div className="text-xs text-muted-foreground">Date</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-sm font-medium">{formatTime(appointment.appointment_time)}</div>
                  <div className="text-xs text-muted-foreground">Time</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-sm font-medium">{getHospitalName(appointment.hospital_id)}</div>
                  <div className="text-xs text-muted-foreground">Hospital</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-sm font-medium">{getDepartmentName(appointment.department_id)}</div>
                  <div className="text-xs text-muted-foreground">Department</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Assignment Results Header */}
      <div className="text-center">
        <div className="text-lg font-medium text-green-700 mb-2">
          {assignmentResult.length === 0 ? 'No Patients Found' : 'Assignment Options Found'}
        </div>
        <div className="text-sm text-muted-foreground">
          {assignmentResult.length === 0 
            ? 'No suitable patients found for this appointment'
            : 'Select one patient to assign to this appointment'
          }
        </div>
      </div>
      
      {/* Patient Cards */}
      <div className="space-y-4">
        {assignmentResult.map((patient) => (
          <Card 
            key={patient.waitlist_id} 
            className={`border-l-4 transition-all duration-200 cursor-pointer hover:shadow-md py-2 ${
              selectedPatientId === patient.waitlist_id 
                ? 'border-l-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-200' 
                : 'border-l-gray-300 hover:bg-gray-50 hover:border-l-gray-400'
            }`}
            onClick={() => setSelectedPatientId(
              selectedPatientId === patient.waitlist_id ? null : patient.waitlist_id
            )}
          >
            <CardContent className="px-6 py-2">
              <div className="flex items-start gap-4">
                <Checkbox
                  checked={selectedPatientId === patient.waitlist_id}
                  onCheckedChange={(checked) => {
                    setSelectedPatientId(checked ? patient.waitlist_id : null)
                  }}
                  className="mt-1.5"
                />
                
                <div className="flex-1 space-y-4">
                  {/* Patient Header */}
                  <div className="space-y-2">
                    <div className="font-mono text-base font-semibold text-gray-900">
                      {patient.waitlist_id}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Medical Number: </span>
                          <span className="font-mono font-medium">{patient.medical_number}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Date of Birth: </span>
                          <span className="font-medium">{formatDate(patient.date_of_birth)}</span>
                        </div>
                      </div>
                      <Link 
                        href={`/waitlist?waitlist_id=${patient.waitlist_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-white bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded transition-colors font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                  
                  {/* Clinical Assessment */}
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Clinical Assessment
                      </div>
                      {patient.proximity !== undefined && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span>{(patient.proximity / 1000).toFixed(1)} km</span>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground mb-2">Clinical Urgency</div>
                        <div className={`text-base font-semibold ${getIntegerSeverityColor(patient.clinical_urgency)}`}>
                          {getSeverityLabel(patient.clinical_urgency)}
                        </div>
                      </div>
                      <div className="text-center border-l border-r border-gray-200 px-2">
                        <div className="text-xs text-muted-foreground mb-2">Condition Severity</div>
                        <div className={`text-base font-semibold ${getIntegerSeverityColor(patient.condition_severity)}`}>
                          {getSeverityLabel(patient.condition_severity)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground mb-2">Comorbidities</div>
                        <div className={`text-base font-semibold ${getFloatSeverityColor(patient.comorbidities)}`}>
                          {patient.comorbidities !== null ? patient.comorbidities.toFixed(2) : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Reasoning */}
                  {patient.reasoning && (
                    <div className="border-t pt-4">
                      <div className="text-xs font-medium text-muted-foreground mb-2">Reasoning</div>
                      <div className="p-3 bg-muted rounded-md text-sm">
                        {patient.reasoning}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )

  return (
    <Dialog open={isOpen} onOpenChange={currentPage === 'assigning' ? undefined : (currentPage === 'success' ? handleSuccessClose : handleClose)}>
      <DialogContent 
        className={`max-w-4xl max-h-[90vh] ${currentPage === 'manual-result' ? 'flex flex-col' : 'overflow-y-auto'}`}
        showCloseButton={currentPage !== 'assigning' && currentPage !== 'success'}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-3 flex-shrink-0">
          <DialogTitle className="text-2xl font-bold text-primary">
            {currentPage === 'details' && 'Appointment Details'}
            {currentPage === 'loading' && 'Processing Assignment'}
            {currentPage === 'result' && 'Assignment Options'}
            {currentPage === 'assigning' && 'Completing Assignment'}
            {currentPage === 'success' && (assignmentResponse?.success ? 'Assignment Complete' : 'Assignment Failed')}
            {currentPage === 'manual-loading' && 'Loading Waitlist'}
            {currentPage === 'manual-result' && 'Manual Assignment Options'}
          </DialogTitle>
        </DialogHeader>

        {currentPage === 'manual-result' ? (
          <>
            <div className="flex-1 overflow-y-auto">
              {renderManualResultPage()}
            </div>
            {manualPaginationData.total_pages > 1 && (
              <div className="flex-shrink-0 border-t bg-background px-4 py-2 mt-2">
                <div className="flex justify-center">
                  <TablePagination
                    currentPage={manualPaginationData.page}
                    totalPages={manualPaginationData.total_pages}
                    hasNext={manualPaginationData.has_next}
                    hasPrev={manualPaginationData.has_prev}
                    onPageChange={handleManualPageChange}
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {currentPage === 'details' && renderDetailsPage()}
            {currentPage === 'loading' && renderLoadingPage()}
            {currentPage === 'result' && renderResultPage()}
            {currentPage === 'assigning' && renderAssigningPage()}
            {currentPage === 'success' && renderSuccessPage()}
            {currentPage === 'manual-loading' && renderManualLoadingPage()}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
} 