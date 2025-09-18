"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { DateTimePicker } from "@/components/datetime-picker"
import { Card, CardContent } from "@/components/ui/card"
import { Calendar, Loader2, Plus, Trash2 } from "lucide-react"
import { useDepartments, useHospitals } from "@/hooks/use-reference-data"
import { addAppointment, Appointment } from "@/lib/api"
import { AppointmentModal } from "@/components/appointment-modal"
import { useState, useEffect } from "react"

interface AddAppointmentModalProps {
  isOpen: boolean
  onClose: (shouldRefresh?: boolean) => void
}

type ModalPage = 'form' | 'submitting' | 'error' | 'appointment-modal'

interface PropertyV3Entry {
  id: string
  value: string
}

interface AppointmentWithStatus extends Appointment {
  status: string
}

export function AddAppointmentModal({ isOpen, onClose }: AddAppointmentModalProps) {
  const { departments } = useDepartments()
  const { hospitals } = useHospitals()
  
  const [currentPage, setCurrentPage] = useState<ModalPage>('form')
  
  // Form fields
  const [appointmentDateTime, setAppointmentDateTime] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [hospitalId, setHospitalId] = useState('')
  const [assignNow, setAssignNow] = useState(true)
  const [propertiesV3, setPropertiesV3] = useState<PropertyV3Entry[]>([
    { id: '1', value: '' }
  ])
  
  // State for appointment modal
  const [createdAppointment, setCreatedAppointment] = useState<AppointmentWithStatus | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentPage('form')
      setAppointmentDateTime('')
      setDepartmentId('')
      setHospitalId('')
      setAssignNow(true)
      setPropertiesV3([{ id: '1', value: '' }])
      setCreatedAppointment(null)
      setSubmitError(null)
    }
  }, [isOpen])

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


  const handleAddPropertyV3 = () => {
    const newId = (Math.max(...propertiesV3.map(p => parseInt(p.id))) + 1).toString()
    setPropertiesV3([...propertiesV3, { id: newId, value: '' }])
  }

  const handleRemovePropertyV3 = (id: string) => {
    if (propertiesV3.length > 1) {
      setPropertiesV3(propertiesV3.filter(p => p.id !== id))
    }
  }

  const updatePropertyV3 = (id: string, value: string) => {
    setPropertiesV3(propertiesV3.map(p => 
      p.id === id ? { ...p, value } : p
    ))
  }

  // Helper function to convert title case to snake_case
  const convertToSnakeCase = (str: string): string => {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  }

  // Check if a property value would create a duplicate
  const wouldCreateDuplicateProperty = (value: string, currentEntryId: string) => {
    if (!value.trim()) return false
    
    const snakeValue = convertToSnakeCase(value)
    const existingValues = propertiesV3
      .filter(p => p.id !== currentEntryId && p.value.trim())
      .map(p => convertToSnakeCase(p.value))
    
    return existingValues.includes(snakeValue)
  }

  // Check if there are duplicate property names
  const hasDuplicateProperties = () => {
    const values = propertiesV3
      .filter(p => p.value.trim())
      .map(p => convertToSnakeCase(p.value))
    return values.length !== new Set(values).size
  }

  // Get formatted properties for submission (convert to snake_case)
  const getFormattedProperties = () => {
    return propertiesV3
      .filter(p => p.value.trim())
      .map(p => convertToSnakeCase(p.value))
  }

  // Get minimum allowed datetime (1 hour from now)
  const getMinDateTime = () => {
    const now = new Date()
    now.setHours(now.getHours() + 1)
    return now.toISOString().slice(0, 19) + ':00'
  }

  // Validate appointment datetime
  const isValidDateTime = (dateTime: string) => {
    if (!dateTime) return false
    
    const appointmentDate = new Date(dateTime)
    const now = new Date()
    
    // Get just the date parts (without time)
    const appointmentDateOnly = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate())
    const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    // If appointment is on a future date, any time is valid
    if (appointmentDateOnly > todayDateOnly) {
      return true
    }
    
    // If appointment is in the past (previous day), it's invalid
    if (appointmentDateOnly < todayDateOnly) {
      return false
    }
    
    // If appointment is today, it must be at least 1 hour from now
    const oneHourFromNow = new Date(now.getTime() + (60 * 60 * 1000))
    return appointmentDate >= oneHourFromNow
  }

  // Form validation
  const isFormValid = () => {
    return appointmentDateTime !== '' &&
           departmentId !== '' &&
           hospitalId !== '' &&
           isValidDateTime(appointmentDateTime) &&
           !hasDuplicateProperties()
  }

  const handleSubmit = async () => {
    if (!isFormValid()) return
    
    setCurrentPage('submitting')
    
    try {
      const formattedProperties = getFormattedProperties()
      
      const newAppointment = await addAppointment({
        appointment_time: appointmentDateTime,
        department_id: departmentId,
        hospital_id: hospitalId,
        auto_assign: assignNow,
        properties: formattedProperties.length > 0 ? formattedProperties : undefined
      })
      
      // Create appointment with status for the modal
      const appointmentWithStatus: AppointmentWithStatus = {
        ...newAppointment,
        status: 'scheduled'
      }
      
      setCreatedAppointment(appointmentWithStatus)
      setCurrentPage('appointment-modal')
    } catch (error) {
      console.error('Failed to add appointment:', error)
      setSubmitError('There was an issue adding the appointment. Please try again.')
      setCurrentPage('error')
    }
  }

  const handleClose = (shouldRefresh = false) => {
    setCurrentPage('form')
    onClose(shouldRefresh)
  }

  const handleAppointmentModalClose = (shouldRefresh?: boolean, assignmentData?: { success: boolean; waitlist_id?: string }) => {
    if (assignmentData?.success && assignmentData.waitlist_id && createdAppointment) {
      // Update the appointment with the new waitlist_id and re-open the modal
      const updatedAppointment = {
        ...createdAppointment,
        waitlist_id: assignmentData.waitlist_id
      }
      setCreatedAppointment(updatedAppointment)
      setCurrentPage('appointment-modal')
    } else {
      handleClose(true) // This will call onClose(true) which triggers handleRefresh
    }
  }

  const renderSubmittingPage = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      <div className="text-lg font-medium">Creating appointment...</div>
      <div className="text-sm text-muted-foreground">Please wait while we process your request</div>
    </div>
  )

  const renderErrorPage = () => (
    <div className="flex flex-col items-center justify-center py-6 space-y-6">
      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
        <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <div className="text-center space-y-2">
        <div className="text-xl font-semibold text-red-800">
          Failed to Add Appointment
        </div>
        <div className="text-sm text-muted-foreground">
          {submitError || 'There was an issue creating the appointment. Please try again.'}
        </div>
      </div>
      <Button 
        onClick={() => setCurrentPage('form')}
        variant="outline"
        className="cursor-pointer"
      >
        Back
      </Button>
    </div>
  )

  const renderFormPage = () => (
    <div className="space-y-6">
          {/* Required Fields */}
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <DateTimePicker
                label="Appointment Date & Time *"
                value={appointmentDateTime}
                onChange={setAppointmentDateTime}
                placeholder="Select date and time"
                className="w-64"
                labelClassName="text-base font-medium"
                min={getMinDateTime()}
              />
              {appointmentDateTime && !isValidDateTime(appointmentDateTime) && (
                <p className="text-sm text-red-600">
                  {(() => {
                    const appointmentDate = new Date(appointmentDateTime)
                    const now = new Date()
                    const appointmentDateOnly = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate())
                    const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate())
                    
                    if (appointmentDateOnly < todayDateOnly) {
                      return "Appointment cannot be scheduled in the past"
                    } else {
                      return "Appointment must be at least 1 hour from now"
                    }
                  })()}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Select
                label="Hospital *"
                value={hospitalId}
                onChange={setHospitalId}
                options={hospitalOptions}
                placeholder="Select hospital..."
                className="w-full"
                labelClassName="text-base font-medium"
              />
            </div>
            <div className="space-y-2">
              <Select
                label="Department *"
                value={departmentId}
                onChange={setDepartmentId}
                options={departmentOptions}
                placeholder="Select department..."
                className="w-full"
                labelClassName="text-base font-medium"
              />
            </div>
          </div>

          {/* Properties */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-medium">
                  Appointment Properties
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Add one property per card
                </p>
                {hasDuplicateProperties() && (
                  <p className="text-sm text-red-600 mt-1">
                    Duplicate property names are not allowed
                  </p>
                )}
              </div>
              <Button
                type="button"
                onClick={handleAddPropertyV3}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Property
              </Button>
            </div>
            
            <div className="space-y-3">
              {propertiesV3.map((entry) => {
                const hasDuplicateValue = wouldCreateDuplicateProperty(entry.value, entry.id)
                
                return (
                  <Card key={entry.id} className={`p-4 ${hasDuplicateValue ? 'border-red-200' : ''}`}>
                    <CardContent className="p-0">
                      <div className="flex items-start gap-4">
                        <div className="flex-1">
                          <div className="space-y-2">
                            <Label htmlFor={`property-v3-value-${entry.id}`} className="text-base font-medium">Property</Label>
                            <Input
                              id={`property-v3-value-${entry.id}`}
                              value={entry.value}
                              onChange={(e) => updatePropertyV3(entry.id, e.target.value)}
                              placeholder="e.g. Female Doctor/Spanish/Wheelchair Accessible..."
                              className={hasDuplicateValue ? 'border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20' : ''}
                            />
                            {hasDuplicateValue && (
                              <p className="text-sm text-red-600">
                                This property already exists
                              </p>
                            )}
                          </div>
                        </div>
                        {propertiesV3.length > 1 && (
                          <Button
                            type="button"
                            onClick={() => handleRemovePropertyV3(entry.id)}
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 mt-6"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Submit Options */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="assign-now"
                  checked={assignNow}
                  onCheckedChange={(checked) => setAssignNow(checked as boolean)}
                />
                <Label
                  htmlFor="assign-now"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  AI Patient Assignment
                </Label>
              </div>
              <div className="text-xs text-muted-foreground ml-6">
                You can also assign later - AI or manual
              </div>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={!isFormValid()}
              className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Appointment
            </Button>
          </div>
    </div>
  )

  return (
    <>
      <Dialog 
        open={isOpen && currentPage !== 'appointment-modal'} 
        onOpenChange={currentPage === 'submitting' ? undefined : handleClose}
      >
        <DialogContent 
          className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full"
          showCloseButton={currentPage !== 'submitting'}
        >
          <DialogHeader className="pb-4">
            <DialogTitle className="text-2xl font-bold text-primary flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              {currentPage === 'form' && 'Add New Appointment'}
              {currentPage === 'submitting' && 'Creating Appointment'}
              {currentPage === 'error' && 'Error Adding Appointment'}
            </DialogTitle>
          </DialogHeader>

          {currentPage === 'form' && renderFormPage()}
          {currentPage === 'submitting' && renderSubmittingPage()}
          {currentPage === 'error' && renderErrorPage()}
        </DialogContent>
      </Dialog>

      <AppointmentModal
        isOpen={currentPage === 'appointment-modal'}
        onClose={handleAppointmentModalClose}
        appointment={createdAppointment ? {
          appointment_id: createdAppointment.appointment_id,
          appointment_time: createdAppointment.appointment_time,
          waitlist_id: createdAppointment.waitlist_id || '',
          department_id: createdAppointment.department_id,
          hospital_id: createdAppointment.hospital_id,
          status: createdAppointment.status,
          properties: createdAppointment.properties,
          assign_at: createdAppointment.assign_at
        } : null}
      />
    </>
  )
}