// API configuration and data fetching utilities
import departmentsData from '../../public/departments.json'
import hospitalsData from '../../public/hospitals.json'
import { auth } from './firebase'

const ENDPOINT_URL = "https://localhost:8080/api" // Update with your backend API URL

// Authenticated fetch wrapper that automatically includes Firebase auth token
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const user = auth.currentUser
  
  if (!user) {
    throw new Error('User not authenticated')
  }

  const token = await user.getIdToken()
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...options.headers,
  }

  return fetch(url, {
    ...options,
    headers,
  })
}

// Verify user authentication with backend
export async function verifyAuth(): Promise<void> {
  const response = await authenticatedFetch(`${ENDPOINT_URL}/auth`, {
    method: 'POST',
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.detail || 'Access denied. Please contact an administrator.')
  }
}

// Request deduplication cache
const pendingRequests = new Map<string, Promise<unknown>>()

function dedupeFetch<T>(url: string): Promise<T> {
  if (pendingRequests.has(url)) {
    return pendingRequests.get(url)! as Promise<T>
  }

  const request = authenticatedFetch(url).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`)
    }
    return response.json()
  }) as Promise<T>
  
  pendingRequests.set(url, request)
  
  // Clean up after request completes
  request.finally(() => {
    pendingRequests.delete(url)
  })
  
  return request
}

export interface Department {
  department_id: string
  department_name: string
}

export interface Hospital {
  hospital_id: string
  hospital_name: string
  address_line1: string
  address_line2: string
  city: string
  county: string
  post_code: string
  longitude: number
  latitude: number
}

export interface Appointment {
  appointment_id: string
  appointment_time: string
  waitlist_id: string | null
  department_id: string
  hospital_id: string
  properties: string[] | null
  assign_at: string | null
}

export interface Patient {
  waitlist_id: string
  medical_number: string
  date_of_birth: string
  postcode: string
  department_id: string
  referral_notes: string
  referral_date: string
  medical_history: Array<{
    date: string
    notes: string
  }>
  clinical_urgency: 1 | 2 | 3 | null
  condition_severity: 1 | 2 | 3 | null
  comorbidities: number | null
  agent_justification: string | null
  edited_at: string | null
  is_seen: boolean | null
  is_assigned: boolean | null
  grading_status: 'GRADING' | 'COMPLETED' | 'FAILED' | null
  graded_at: string | null
  preferences: Record<string, string> | null
  prefers_evening: boolean | null
}

export interface DashboardData {
  total_appointments: number
  unassigned_patients: number
}

export interface PaginatedResponse<T> {
  results: T[]
  total: number
  page: number
  total_pages: number
  has_next: boolean
  has_prev: boolean
}

// Fetch departments
export async function fetchDepartments(): Promise<Department[]> {
  try {
    const data = await dedupeFetch<Department[]>(`${ENDPOINT_URL}/departments/`)
    return data
  } catch (error) {
    console.error('Error fetching departments:', error)
    return getFallbackDepartments()
  }
}

// Fetch hospitals
export async function fetchHospitals(): Promise<Hospital[]> {
  try {
    const data = await dedupeFetch<Hospital[]>(`${ENDPOINT_URL}/hospitals/`)
    return data
  } catch (error) {
    console.error('Error fetching hospitals:', error)
    return getFallbackHospitals()
  }
}

// Fetch appointments with filtering
export async function fetchAppointments(filters?: {
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
}): Promise<PaginatedResponse<Appointment>> {
  try {
    const searchParams = new URLSearchParams()
    
    if (filters?.appointmentId) {
      searchParams.append('appointment_id', filters.appointmentId)
    }
    if (filters?.waitlistId) {
      searchParams.append('waitlist_id', filters.waitlistId)
    }
    if (filters?.startTime) {
      searchParams.append('start_time', filters.startTime)
    }
    if (filters?.endTime) {
      searchParams.append('end_time', filters.endTime)
    }
    if (filters?.hospitalId) {
      searchParams.append('hospital_id', filters.hospitalId)
    }
    if (filters?.departmentId) {
      searchParams.append('department_id', filters.departmentId)
    }
    if (filters?.status) {
      searchParams.append('status', filters.status)
    }
    if (filters?.orderBy) {
      searchParams.append('order_by', filters.orderBy)
    }
    if (filters?.orderDir) {
      searchParams.append('order_dir', filters.orderDir)
    }
    if (filters?.page) {
      searchParams.append('page', filters.page.toString())
    }
    
    const queryString = searchParams.toString()
    const url = queryString 
      ? `${ENDPOINT_URL}/appointments/?${queryString}`
      : `${ENDPOINT_URL}/appointments/`
      
    const data = await dedupeFetch<PaginatedResponse<Appointment>>(url)
    return data
  } catch (error) {
    console.error('Error fetching appointments:', error)
    return {
      results: [],
      total: 0,
      page: 1,
      total_pages: 0,
      has_next: false,
      has_prev: false
    }
  }
}

// Fetch patients with filtering
export async function fetchPatients(filters?: {
  waitlistId?: string
  medicalNumber?: string
  postcode?: string
  minClinicalUrgency?: number
  maxClinicalUrgency?: number
  minConditionSeverity?: number
  maxConditionSeverity?: number
  minComorbidities?: number
  maxComorbidities?: number
  minReferralDate?: string
  maxReferralDate?: string
  departmentId?: string
  gradingStatus?: number
  assignmentStatus?: number
  orderBy?: string
  orderDir?: string
  page?: number
}): Promise<PaginatedResponse<Patient>> {
  try {
    const searchParams = new URLSearchParams()
    
    if (filters?.waitlistId) {
      searchParams.append('waitlist_id', filters.waitlistId)
    }
    if (filters?.medicalNumber) {
      searchParams.append('medical_number', filters.medicalNumber)
    }
    if (filters?.postcode) {
      searchParams.append('postcode', filters.postcode)
    }
    if (filters?.minClinicalUrgency) {
      searchParams.append('min_clinical_urgency', filters.minClinicalUrgency.toString())
      searchParams.append('max_clinical_urgency', filters.minClinicalUrgency.toString())
    }
    if (filters?.minConditionSeverity) {
      searchParams.append('min_condition_severity', filters.minConditionSeverity.toString())
      searchParams.append('max_condition_severity', filters.minConditionSeverity.toString())
    }
    if (filters?.minComorbidities !== undefined) {
      searchParams.append('min_comorbidities', filters.minComorbidities.toString())
    }
    if (filters?.minReferralDate) {
      searchParams.append('min_referral_date', filters.minReferralDate)
    }
    if (filters?.maxReferralDate) {
      searchParams.append('max_referral_date', filters.maxReferralDate)
    }
    if (filters?.departmentId) {
      searchParams.append('department_id', filters.departmentId)
    }
    if (filters?.gradingStatus !== undefined) {
      searchParams.append('grading_status', filters.gradingStatus.toString())
    }
    if (filters?.assignmentStatus !== undefined) {
      searchParams.append('assignment_status', filters.assignmentStatus.toString())
    }
    if (filters?.orderBy) {
      searchParams.append('order_by', filters.orderBy)
    }
    if (filters?.orderDir) {
      searchParams.append('order_dir', filters.orderDir)
    }
    if (filters?.page) {
      searchParams.append('page', filters.page.toString())
    }
    
    const queryString = searchParams.toString()
    const url = queryString 
      ? `${ENDPOINT_URL}/waitlist/?${queryString}`
      : `${ENDPOINT_URL}/waitlist/`
      
    const data = await dedupeFetch<PaginatedResponse<Patient>>(url)
    return data
  } catch (error) {
    console.error('Error fetching patients:', error)
    return {
      results: [],
      total: 0,
      page: 1,
      total_pages: 0,
      has_next: false,
      has_prev: false
    }
  }
}

// Fetch dashboard data
export async function fetchDashboardData(): Promise<DashboardData> {
  try {
    const data = await dedupeFetch<DashboardData>(`${ENDPOINT_URL}/dashboard/`)
    return data
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    throw error
  }
}

// Grade patient severity
export async function gradePatient(waitlistId: string): Promise<Patient> {
  try {
    const response = await authenticatedFetch(`${ENDPOINT_URL}/waitlist/grade/${waitlistId}`)
    
    if (!response.ok) {
      throw new Error(`Failed to grade patient: ${response.statusText}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error grading patient:', error)
    throw error
  }
}

// Override patient grade with manual values
export async function overrideGrade(waitlistId: string, overrideData: {
  clinical_urgency: 1 | 2 | 3 | null
  condition_severity: 1 | 2 | 3 | null
  comorbidities: number | null
}): Promise<Patient> {
  try {
    console.log(JSON.stringify(overrideData))
    const response = await authenticatedFetch(`${ENDPOINT_URL}/waitlist/override-grade/${waitlistId}`, {
      method: 'POST',
      body: JSON.stringify(overrideData),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }))
      throw new Error(errorData.detail || `Failed to override grade: ${response.statusText}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error overriding grade:', error)
    throw error
  }
}


export interface AssignmentResult {
  successful: number
  failed: number
}


// Assign selected appointments
export async function assignSelectedAppointments(appointmentIds: string[]): Promise<AssignmentResult> {
  try {
    const response = await authenticatedFetch(`${ENDPOINT_URL}/match/assign-selected`, {
      method: 'POST',
      body: JSON.stringify(appointmentIds),
    })
    
    if (!response.ok) {
      throw new Error(`Failed to assign selected appointments: ${response.statusText}`)
    }
    
    const result = await response.json()
    return result as AssignmentResult
  } catch (error) {
    console.error('Error assigning selected appointments:', error)
    throw error
  }
}

export interface AssignmentPatient {
  waitlist_id: string
  medical_number: string
  date_of_birth: string
  clinical_urgency: 1 | 2 | 3 | null
  condition_severity: 1 | 2 | 3 | null
  comorbidities: number | null
  proximity?: number
  reasoning?: string
}

// Manual assignment for single appointment
export async function manualAssignAppointment(appointmentId: string): Promise<AssignmentPatient[]> {
  try {
    const response = await authenticatedFetch(`${ENDPOINT_URL}/match/get-candidates?appointment_id=${appointmentId}`)
    
    if (!response.ok) {
      throw new Error(`Failed to manually assign appointment: ${response.statusText}`)
    }
    
    const result = await response.json()
    return result as AssignmentPatient[]
  } catch (error) {
    console.error('Error manually assigning appointment:', error)
    throw error
  }
}

// Fetch waitlist patients for manual assignment
export async function fetchWaitlistForManualAssignment(
  departmentId: string, 
  page: number = 1, 
  limit: number = 5, 
  medicalNumber?: string
): Promise<PaginatedResponse<Patient>> {
  try {
    const searchParams = new URLSearchParams()
    searchParams.append('department_id', departmentId)
    searchParams.append('limit', limit.toString())
    searchParams.append('page', page.toString())
    searchParams.append('assignment_status', '0')
    
    if (medicalNumber && medicalNumber.trim()) {
      searchParams.append('medical_number', medicalNumber.trim())
    }
    
    const response = await authenticatedFetch(`${ENDPOINT_URL}/waitlist?${searchParams.toString()}`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch waitlist patients: ${response.statusText}`)
    }
    
    const result = await response.json()
    return result as PaginatedResponse<Patient>
  } catch (error) {
    console.error('Error fetching waitlist patients for manual assignment:', error)
    throw error
  }
}

export interface AssignmentResponse {
  success?: string
  error?: string
  waitlist_id?: string
}

// Assign appointment to specific patient
export async function assignAppointmentToPatient(appointmentId: string, waitlistId: string, email: string): Promise<AssignmentResponse> {
  try {
    const response = await authenticatedFetch(`${ENDPOINT_URL}/match/manual-assign`, {
      method: 'POST',
      body: JSON.stringify({
        appointment_id: appointmentId,
        waitlist_id: waitlistId,
        email: email
      }),
    })
    
    if (!response.ok) {
      throw new Error(`Failed to assign appointment: ${response.statusText}`)
    }
    
    const result = await response.json()
    return result as AssignmentResponse
  } catch (error) {
    console.error('Error assigning appointment:', error)
    throw error
  }
}

// Add new appointment
export async function addAppointment(appointmentData: {
  appointment_time: string
  department_id: string
  hospital_id: string
  auto_assign: boolean
  properties?: string[]
}): Promise<Appointment> {
  try {
    const response = await authenticatedFetch(`${ENDPOINT_URL}/appointments/add`, {
      method: 'POST',
      body: JSON.stringify(appointmentData),
    })
    console.log(JSON.stringify(appointmentData))
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }))
      throw new Error(errorData.detail || `Failed to add appointment: ${response.statusText}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error adding appointment:', error)
    throw error
  }
}

// Add new patient with streaming support for auto-grading
export async function addPatient(
  patientData: {
    medical_number: string
    referral_department: string
    referral_date: string
    referral_notes: string
    auto_grade: boolean
    prefers_evening?: boolean
    date_of_birth?: string
    postcode?: string
    medical_history?: Array<{ date: string; notes: string }>
    preferences?: Record<string, string>
  },
  onPatientAdded?: (patient: Patient) => void,
  onPatientGraded?: (patient: Patient) => void,
  onGradingFailed?: (message: string) => void
): Promise<Patient> {
  try {
    const response = await authenticatedFetch(`${ENDPOINT_URL}/waitlist/add`, {
      method: 'POST',
      body: JSON.stringify(patientData),
    })
    
    if (!response.ok) {
      throw new Error(`Failed to add patient: ${response.statusText}`)
    }
    
    // Handle streaming response for auto-grade
    if (patientData.auto_grade && response.headers.get('content-type')?.includes('text/event-stream')) {
      let addedPatient: Patient | null = null
      
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      
      if (!reader) {
        throw new Error('Unable to read streaming response')
      }
      
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                
                if (data.status === 'added') {
                  addedPatient = data.patient as Patient
                  if (onPatientAdded) {
                    onPatientAdded(addedPatient)
                  }
                } else if (data.status === 'graded') {
                  const gradedPatient = data.patient as Patient
                  if (onPatientGraded) {
                    onPatientGraded(gradedPatient)
                  }
                  return gradedPatient
                } else if (data.status === 'grading_failed') {
                  if (onGradingFailed) {
                    onGradingFailed(data.message)
                  }
                  // Return the added patient even if grading failed
                  if (addedPatient) {
                    return addedPatient
                  }
                }
              } catch (parseError) {
                console.error('Error parsing SSE data:', parseError)
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }
      
      // Fallback - return added patient if streaming completed without graded result
      if (addedPatient) {
        return addedPatient
      }
      
      throw new Error('No patient data received from streaming response')
    } else {
      // Handle normal JSON response for non-auto-grade
      const result = await response.json()
      const patient = result as Patient
      if (onPatientAdded) {
        onPatientAdded(patient)
      }
      return patient
    }
  } catch (error) {
    console.error('Error adding patient:', error)
    throw error
  }
}

// Fallback hospital and department data - imported from JSON files
function getFallbackDepartments(): Department[] {
  return departmentsData as Department[]
}

function getFallbackHospitals(): Hospital[] {
  return hospitalsData as Hospital[]
}
