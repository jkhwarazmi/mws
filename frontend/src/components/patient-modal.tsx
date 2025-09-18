"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { User, FileText, Activity, Calendar, Clock, Loader2, Calculator, Edit, Save, X, Moon } from "lucide-react"
import { useDepartments } from "@/hooks/use-reference-data"
import { Patient, gradePatient, overrideGrade } from "@/lib/api"

interface PatientModalProps {
  isOpen: boolean
  onClose: () => void
  patient: Patient | null
  onPatientUpdate?: (updatedPatient: Patient) => void
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
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

// Convert snake_case to Title Case
function formatPreferenceKey(key: string) {
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export function PatientModal({ isOpen, onClose, patient, onPatientUpdate }: PatientModalProps) {
  const { getDepartmentName } = useDepartments()
  const [isGradingInProgress, setIsGradingInProgress] = useState(false)
  const [isOverrideInProgress, setIsOverrideInProgress] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValues, setEditValues] = useState({
    clinical_urgency: null as 1 | 2 | 3 | null,
    condition_severity: null as 1 | 2 | 3 | null,
    comorbidities: null as number | null
  })

  // Initialise edit values when entering edit mode
  const handleStartEdit = () => {
    if (!patient) return
    setEditValues({
      clinical_urgency: patient.clinical_urgency,
      condition_severity: patient.condition_severity,
      comorbidities: patient.comorbidities
    })
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditValues({
      clinical_urgency: null,
      condition_severity: null,
      comorbidities: null
    })
  }

  // Check if any values have changed from original
  const hasChanges = () => {
    if (!patient) return false
    return editValues.clinical_urgency !== patient.clinical_urgency ||
           editValues.condition_severity !== patient.condition_severity ||
           editValues.comorbidities !== patient.comorbidities
  }

  // Check if form is valid (both selects must have values)
  const isFormValid = () => {
    return editValues.clinical_urgency !== null && editValues.condition_severity !== null
  }

  // Severity options for selects
  const severityOptions = [
    { value: "3", label: "High" },
    { value: "2", label: "Medium" },
    { value: "1", label: "Low" }
  ]

  // Handle override submission
  const handleOverrideSubmit = async () => {
    if (!patient?.waitlist_id || !hasChanges()) return
    
    setIsOverrideInProgress(true)
    
    // Store original values for rollback on error
    const originalValues = {
      clinical_urgency: patient.clinical_urgency,
      condition_severity: patient.condition_severity,
      comorbidities: patient.comorbidities
    }
    
    // Immediately update local state to show grading status
    const gradingPatient: Patient = {
      ...patient,
      grading_status: 'GRADING'
    }
    
    // Notify parent component to update table immediately
    if (onPatientUpdate) {
      onPatientUpdate(gradingPatient)
    }
    
    try {
      const updatedPatient = await overrideGrade(patient.waitlist_id, {
        clinical_urgency: editValues.clinical_urgency,
        condition_severity: editValues.condition_severity,
        comorbidities: editValues.comorbidities
      })
      
      // Notify parent component of the successful update
      if (onPatientUpdate) {
        onPatientUpdate(updatedPatient)
      }
      
      // Exit edit mode on success
      setIsEditing(false)
      
    } catch (error) {
      console.error('Failed to override grade:', error)
      
      // Revert to original values on error
      const revertedPatient: Patient = {
        ...patient,
        ...originalValues,
        grading_status: patient.grading_status
      }
      
      if (onPatientUpdate) {
        onPatientUpdate(revertedPatient)
      }
      
      // Reset edit values to original
      setEditValues({
        clinical_urgency: originalValues.clinical_urgency,
        condition_severity: originalValues.condition_severity,
        comorbidities: originalValues.comorbidities
      })
    } finally {
      setIsOverrideInProgress(false)
    }
  }
  
  if (!patient) return null

  const isGrading = patient.grading_status === 'GRADING' || isGradingInProgress || isOverrideInProgress
  const isRegularGrading = (patient.grading_status === 'GRADING' || isGradingInProgress) && !isOverrideInProgress
  const isFailed = patient.grading_status === 'FAILED'
  const isCompleted = patient.grading_status === 'COMPLETED'

  const handleModalClose = () => {
    onClose()
  }

  const handleGradePatient = async () => {
    if (!patient?.waitlist_id || isGradingInProgress) return
    
    setIsGradingInProgress(true)
    
    // Immediately update local state to show grading status
    const gradingPatient: Patient = {
      ...patient,
      grading_status: 'GRADING'
    }
    
    // Notify parent component to update table immediately
    if (onPatientUpdate) {
      onPatientUpdate(gradingPatient)
    }
    
    try {
      const updatedPatient = await gradePatient(patient.waitlist_id)
      
      // Notify parent component of the update with the complete patient object
      if (onPatientUpdate) {
        onPatientUpdate(updatedPatient)
      }
      
    } catch (error) {
      console.error('Failed to grade patient:', error)
      
      // Update to failed state
      const failedPatient: Patient = {
        ...patient,
        grading_status: 'FAILED'
      }
      
      if (onPatientUpdate) {
        onPatientUpdate(failedPatient)
      }
    } finally {
      setIsGradingInProgress(false)
    }
  }

  // Determine which date to show and label
  const displayDate = patient.edited_at || patient.graded_at
  const dateLabel = patient.edited_at ? "Manually graded at" : "Graded at"

  // Determine button text and color
  const hasBeenGraded = patient.graded_at !== null
  const buttonText = hasBeenGraded ? "Recalculate Grade" : "Calculate Grade"
  const buttonColorClass = hasBeenGraded ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'

  return (
    <Dialog open={isOpen} onOpenChange={handleModalClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="space-y-3 pb-4">
          <DialogTitle className="text-2xl font-bold text-primary">
            Patient Details
          </DialogTitle>
          {displayDate && (
            <div className="text-sm text-muted-foreground">
              {dateLabel}: {formatDateTime(displayDate)}
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <Button 
              onClick={handleGradePatient}
              disabled={isGradingInProgress || patient.grading_status === 'GRADING'}
              className={`flex items-center gap-2 ${buttonColorClass} text-white w-fit disabled:opacity-50 cursor-pointer`}
              tabIndex={-1}
            >
              <Calculator className="h-4 w-4" />
              {isGrading ? "Grading..." : buttonText}
            </Button>
            {patient.is_assigned ? (
              <Button 
                onClick={() => {
                  window.open(`/appointments?waitlist_id=${patient.waitlist_id}`, '_blank')
                }}
                variant="outline"
                className="flex items-center gap-2 w-fit cursor-pointer"
                tabIndex={-1}
              >
                <Calendar className="h-4 w-4" />
                View Appointment
              </Button>
            ) : (
              <Badge variant="secondary" className="flex items-center gap-2 w-fit px-3 py-2">
                <Calendar className="h-4 w-4" />
                No appointment assigned
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Patient Header */}
          <Card className="border-l-4 border-l-primary">
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    <span className="text-sm font-semibold font-mono">
                      {patient.medical_number}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Medical Number
                  </div>
                </div>
                <div className="text-right space-y-2">
                  <div className="flex items-center gap-2">
                    {isGrading && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
                    <Badge variant={
                      isCompleted ? "default" : 
                      isGrading ? "secondary" :
                      isFailed ? "destructive" : "outline"
                    }>
                      {isGrading ? "Grading..." : 
                       isFailed ? "Failed" :
                       isCompleted ? "Completed" : "Pending"}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Grading Status
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Patient Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Patient Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Medical Number</div>
                  <div className="font-mono text-sm font-medium">{patient.medical_number}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Date of Birth</div>
                  <div className="text-sm">{formatDate(patient.date_of_birth)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Postcode</div>
                  <div className="font-mono text-sm font-medium">{patient.postcode}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Waitlist ID</div>
                  <div className="font-mono text-sm break-all">{patient.waitlist_id}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Clinical Assessment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Clinical Assessment
                </div>
                {!isGrading && !isEditing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStartEdit}
                    disabled={isOverrideInProgress}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {patient.edited_at && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="text-sm font-medium text-blue-800">
                    Overridden at: {formatDateTime(patient.edited_at)}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Clinical Urgency</div>
                  {isEditing ? (
                    <Select
                      value={editValues.clinical_urgency?.toString() || ""}
                      onChange={(value) => setEditValues(prev => ({ ...prev, clinical_urgency: value ? parseInt(value) as 1 | 2 | 3 : null }))}
                      options={severityOptions}
                      placeholder="Select urgency..."
                      hideEmpty={true}
                    />
                  ) : isGrading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Grading...</span>
                    </div>
                  ) : isFailed ? (
                    <div className="text-red-600 font-medium">Failed</div>
                  ) : (
                    <div className={`text-sm font-medium ${getIntegerSeverityColor(patient.clinical_urgency)}`}>
                      {getSeverityLabel(patient.clinical_urgency)}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Condition Severity</div>
                  {isEditing ? (
                    <Select
                      value={editValues.condition_severity?.toString() || ""}
                      onChange={(value) => setEditValues(prev => ({ ...prev, condition_severity: value ? parseInt(value) as 1 | 2 | 3 : null }))}
                      options={severityOptions}
                      placeholder="Select severity..."
                      hideEmpty={true}
                    />
                  ) : isGrading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Grading...</span>
                    </div>
                  ) : isFailed ? (
                    <div className="text-red-600 font-medium">Failed</div>
                  ) : (
                    <div className={`text-sm font-medium ${getIntegerSeverityColor(patient.condition_severity)}`}>
                      {getSeverityLabel(patient.condition_severity)}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Comorbidities</div>
                  {isEditing ? (
                    <Input
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={editValues.comorbidities?.toString() || ""}
                      onChange={(e) => {
                        const value = e.target.value
                        if (value === "") {
                          setEditValues(prev => ({ ...prev, comorbidities: null }))
                        } else {
                          const num = parseFloat(value)
                          if (!isNaN(num) && num >= 0 && num <= 1) {
                            setEditValues(prev => ({ ...prev, comorbidities: num }))
                          }
                        }
                      }}
                      placeholder="0.00 - 1.00"
                      className="w-full"
                    />
                  ) : isGrading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Grading...</span>
                    </div>
                  ) : isFailed ? (
                    <div className="text-red-600 font-medium">Failed</div>
                  ) : (
                    <div className={`text-sm font-medium ${getFloatSeverityColor(patient.comorbidities)}`}>
                      {patient.comorbidities !== null ? patient.comorbidities.toFixed(2) : 'N/A'}
                    </div>
                  )}
                </div>
              </div>
              {isEditing && (
                <div className="flex justify-end gap-2 mt-4">
                  <Button
                    variant="outline"
                    onClick={handleCancelEdit}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                  <Button
                    onClick={handleOverrideSubmit}
                    disabled={!hasChanges() || !isFormValid() || isOverrideInProgress}
                    className="flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {isOverrideInProgress ? 'Submitting...' : 'Submit'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Justification */}
          {(patient.agent_justification || isRegularGrading || isFailed) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  AI Assessment Justification
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isRegularGrading ? (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Generating justification...</span>
                  </div>
                ) : isFailed ? (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                    <div className="text-destructive font-medium">Assessment Failed</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Unable to generate AI assessment. Please try again or assess manually.
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-muted rounded-md text-sm">
                    {patient.agent_justification}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Referral Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Referral Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Department</div>
                  <div className="font-medium text-sm">{getDepartmentName(patient.department_id)}</div>
                  <div className="text-sm text-muted-foreground">Department ID: {patient.department_id}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Referral Date</div>
                  <div className="text-sm">{formatDateTime(patient.referral_date)}</div>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-2">Referral Notes</div>
                <div className="p-3 bg-muted rounded-md text-sm">
                  {patient.referral_notes}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Medical History */}
          {patient.medical_history && patient.medical_history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Medical History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {patient.medical_history.map((entry, index) => (
                    <div key={index} className="border-l-2 border-primary/20 pl-4 space-y-1">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div className="text-sm font-medium text-muted-foreground">
                          {formatDate(entry.date)}
                        </div>
                      </div>
                      <div className="text-sm">
                        {entry.notes}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Patient Preferences
              </CardTitle>
            </CardHeader>
            <CardContent>
              {patient.preferences && Object.keys(patient.preferences).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(patient.preferences).map(([key, value], index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-muted rounded-md">
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">Preference</div>
                        <div className="text-sm font-bold">{formatPreferenceKey(key)}</div>
                      </div>
                      <div className="md:col-span-2">
                        <div className="text-sm font-medium text-muted-foreground">Value</div>
                        <div className="text-sm">{String(value)}</div>
                      </div>
                    </div>
                  ))}
                  {patient.prefers_evening && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-muted rounded-md">
                      <div className="md:col-span-3">
                        <div className="text-sm font-bold flex items-center gap-2">
                          <Moon className="h-4 w-4" />
                          Prefers evening contact
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center">
                  {patient.prefers_evening ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-muted rounded-md">
                      <div className="md:col-span-3">
                        <div className="text-sm font-bold flex items-center gap-2">
                          <Moon className="h-4 w-4" />
                          Prefers evening contact
                        </div>
                      </div>
                    </div>
                  ) : (
                    "No preferences"
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
} 