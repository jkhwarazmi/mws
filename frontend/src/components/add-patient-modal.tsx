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
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { DatePicker } from "@/components/ui/date-picker"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, Trash2, Loader2 } from "lucide-react"
import { useDepartments } from "@/hooks/use-reference-data"
import { fetchPatients, Patient, addPatient } from "@/lib/api"
import { PatientModal } from "@/components/patient-modal"
import { useState, useEffect, useCallback } from "react"

interface MedicalHistoryEntry {
  id: string
  date: string
  entry: string
}

interface PreferenceEntry {
  id: string
  key: string
  value: string
  isCustom?: boolean
  customKey?: string
}


interface AddPatientModalProps {
  isOpen: boolean
  onClose: (shouldRefresh?: boolean) => void
  onPatientCreated?: (patient: Patient) => void
}

type ModalPage = 'form' | 'submitting' | 'error' | 'patient-modal' | 'grading-error'

function getTodayDate() {
  return new Date().toISOString().split('T')[0]
}

export function AddPatientModal({ isOpen, onClose, onPatientCreated }: AddPatientModalProps) {
  const { departments } = useDepartments()
  const [currentPage, setCurrentPage] = useState<ModalPage>('form')
  
  // Form fields
  const [medicalNumber, setMedicalNumber] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [postcode, setPostcode] = useState('')
  const [referralDepartment, setReferralDepartment] = useState('')
  const [referralDate, setReferralDate] = useState(getTodayDate())
  const [referralNotes, setReferralNotes] = useState('')
  const [medicalHistory, setMedicalHistory] = useState<MedicalHistoryEntry[]>([
    { id: '1', date: '', entry: '' }
  ])
  const [preferences, setPreferences] = useState<PreferenceEntry[]>([
    { id: '1', key: '', value: '', isCustom: false, customKey: '' }
  ])
  const [gradePatient, setGradePatient] = useState(true)
  const [prefersEvening, setPrefersEvening] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null)
  const [gradingError, setGradingError] = useState<string | null>(null)
  
  // Patient search state
  const [searchResults, setSearchResults] = useState<Patient[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [isNewPatient, setIsNewPatient] = useState(true)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentPage('form')
      setMedicalNumber('')
      setDateOfBirth('')
      setPostcode('')
      setReferralDepartment('')
      setReferralDate(getTodayDate())
      setReferralNotes('')
      setMedicalHistory([{ id: '1', date: '', entry: '' }])
      setPreferences([{ id: '1', key: '', value: '', isCustom: false, customKey: '' }])
      setGradePatient(true)
      setPrefersEvening(false)
      setSubmitError(null)
      setSearchResults([])
      setIsSearching(false)
      setSelectedPatient(null)
      setIsNewPatient(true)
      setCurrentPatient(null)
      setGradingError(null)
    }
  }, [isOpen])

  // Convert departments to select options
  const departmentOptions = departments
    .map(department => ({
      value: department.department_id,
      label: department.department_name
    }))
    .sort((a, b) => a.label.localeCompare(b.label))

  // Base preference key options
  const basePreferenceKeyOptions = [
    { value: 'time', label: 'Time' },
    { value: 'day', label: 'Day' },
    { value: 'doctor_gender', label: 'Doctor Gender' },
    { value: 'language', label: 'Language' },
    { value: 'accessibility', label: 'Accessibility' },
    { value: 'other', label: 'Other' }
  ]

  // Get available preference key options for a specific entry (excluding already used keys)
  const getAvailablePreferenceOptions = (currentEntryId: string) => {
    const usedKeys = preferences
      .filter(p => p.id !== currentEntryId && (p.key || p.customKey))
      .map(p => {
        if (p.isCustom && p.customKey) {
          return convertToSnakeCase(p.customKey)
        }
        return p.key
      })
      .filter(key => key && key !== '')

    // Filter out used keys from base options
    return basePreferenceKeyOptions.filter(option => 
      option.value === 'other' || !usedKeys.includes(option.value)
    )
  }

  // Check if a custom key would create a duplicate
  const wouldCreateDuplicate = (customKey: string, currentEntryId: string) => {
    if (!customKey.trim()) return false
    
    const snakeKey = convertToSnakeCase(customKey)
    const existingKeys = preferences
      .filter(p => p.id !== currentEntryId)
      .map(p => {
        if (p.isCustom && p.customKey) {
          return convertToSnakeCase(p.customKey)
        }
        return p.key
      })
      .filter(key => key && key !== '')
    
    return existingKeys.includes(snakeKey)
  }

  // Medical number validation
  const isValidMedicalNumber = (medical: string) => {
    return /^[1-9]\d{9}$/.test(medical)
  }

  // UK postcode validation
  const isValidPostcode = (postcode: string) => {
    const ukPostcodeRegex = /^(?:(?:[A-PR-UWYZ][0-9]{1,2}|[A-PR-UWYZ][A-HK-Y][0-9]{1,2}|[A-PR-UWYZ][0-9][A-HJKSTUW]|[A-PR-UWYZ][A-HK-Y][0-9][ABEHMNPRV-Y])\s?[0-9][ABD-HJLNP-UW-Z]{2}|GIR\s?0AA)$/i
    return ukPostcodeRegex.test(postcode.trim())
  }

  // Check if any preferences have keys but missing values
  const hasIncompletePreferences = () => {
    return preferences.some(p => {
      // Check if preference has a key but no value
      const hasKey = p.isCustom ? (p.customKey && p.customKey.trim()) : (p.key && p.key.trim())
      const hasValue = p.value && p.value.trim()
      return hasKey && !hasValue
    })
  }

  // Get list of incomplete preferences for user feedback
  const getIncompletePreferences = () => {
    return preferences
      .filter(p => {
        const hasKey = p.isCustom ? (p.customKey && p.customKey.trim()) : (p.key && p.key.trim())
        const hasValue = p.value && p.value.trim()
        return hasKey && !hasValue
      })
      .map(p => {
        const keyName = p.isCustom ? p.customKey : (p.key === 'doctor_gender' ? 'Doctor Gender' : 
                      p.key.charAt(0).toUpperCase() + p.key.slice(1))
        return keyName
      })
  }

  // Form validation
  const isFormValid = () => {
    const basicValidation = isValidMedicalNumber(medicalNumber) &&
           (isNewPatient ? (dateOfBirth !== '' && referralDepartment !== '' && referralDate !== '' && referralNotes.trim() !== '') : referralDepartment !== '' && referralDate !== '' && referralNotes.trim() !== '')
    
    // Check for duplicate preference keys
    const duplicateKeys = hasDuplicateKeys()
    
    // Check for incomplete preferences (key without value)
    const incompletePrefs = hasIncompletePreferences()
    
    return basicValidation && !duplicateKeys && !incompletePrefs
  }

  const handleAddMedicalHistory = () => {
    const newId = (Math.max(...medicalHistory.map(h => parseInt(h.id))) + 1).toString()
    setMedicalHistory([...medicalHistory, { id: newId, date: '', entry: '' }])
  }

  const handleRemoveMedicalHistory = (id: string) => {
    if (medicalHistory.length > 1) {
      setMedicalHistory(medicalHistory.filter(h => h.id !== id))
    }
  }

  const updateMedicalHistory = (id: string, field: 'date' | 'entry', value: string) => {
    setMedicalHistory(medicalHistory.map(h => 
      h.id === id ? { ...h, [field]: value } : h
    ))
  }

  const handleAddPreference = () => {
    // Generate a safe ID by finding the highest numeric ID and incrementing
    const numericIds = preferences
      .map(p => {
        const parsed = parseInt(p.id)
        return isNaN(parsed) ? 0 : parsed
      })
    const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 1000
    const newId = (maxId + 1).toString()
    setPreferences([...preferences, { id: newId, key: '', value: '', isCustom: false, customKey: '' }])
  }

  const handleRemovePreference = (id: string) => {
    if (preferences.length > 1) {
      setPreferences(preferences.filter(p => p.id !== id))
    }
  }

  const updatePreference = (id: string, field: 'key' | 'value' | 'customKey', value: string) => {
    setPreferences(preferences.map(p => {
      if (p.id === id) {
        if (field === 'key') {
          // When changing key, reset custom key if not selecting "other"
          return { 
            ...p, 
            [field]: value, 
            isCustom: value === 'other', 
            customKey: value === 'other' ? p.customKey : '' 
          }
        }
        return { ...p, [field]: value }
      }
      return p
    }))
  }

  // Helper function to convert preference key to snake_case
  const convertToSnakeCase = (key: string): string => {
    return key
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  }

  // Helper function to check for duplicate keys
  const hasDuplicateKeys = () => {
    const keys = preferences
      .filter(p => p.key || p.customKey)
      .map(p => {
        if (p.isCustom && p.customKey) {
          return convertToSnakeCase(p.customKey)
        } else if (p.key) {
          return p.key
        }
        return null
      })
      .filter(key => key !== null)
    return keys.length !== new Set(keys).size
  }

  // Helper function to get formatted preferences for submission
  const getFormattedPreferences = () => {
    const validPreferences = preferences.filter(p => {
      if (p.isCustom) {
        return p.customKey && p.customKey.trim() && p.value && p.value.trim()
      }
      return p.key && p.value && p.value.trim()
    })

    const formatted: Record<string, string> = {}
    validPreferences.forEach(p => {
      let key: string
      if (p.isCustom && p.customKey) {
        // Convert custom key to snake_case
        key = convertToSnakeCase(p.customKey)
      } else if (p.key) {
        // Use existing key as-is (could be predefined or existing custom key)
        key = p.key
      } else {
        return // Skip invalid entries
      }
      formatted[key] = p.value.trim()
    })
    
    return formatted
  }


  // Debounced search for existing patients
  const searchPatients = useCallback(async (medicalNumber: string) => {
    if (medicalNumber.length < 3) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const response = await fetchPatients({
        medicalNumber: medicalNumber,
        page: 1
      })
      setSearchResults(response.results.slice(0, 5)) // Limit to 5 results
    } catch (error) {
      console.error('Error searching patients:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (medicalNumber && !selectedPatient) {
        searchPatients(medicalNumber)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [medicalNumber, selectedPatient, searchPatients])

  const handleMedicalNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Only allow digits and limit to 10 characters
    if (/^\d*$/.test(value) && value.length <= 10) {
      setMedicalNumber(value)
      setSelectedPatient(null)
      setIsNewPatient(true)
      if (value.length === 0) {
        setSearchResults([])
      }
    }
  }

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient)
    setMedicalNumber(patient.medical_number)
    setDateOfBirth(patient.date_of_birth)
    setPostcode(patient.postcode)
    setPrefersEvening(patient.prefers_evening || false)
    setIsNewPatient(false)
    setSearchResults([])
    
    // Add existing referral info and medical history
    const existingHistory = [
      {
        id: 'referral',
        date: patient.referral_date,
        entry: patient.referral_notes
      },
      ...patient.medical_history.map((history, index) => ({
        id: `existing-${index}`,
        date: history.date,
        entry: history.notes
      }))
    ]
    setMedicalHistory(existingHistory)
    
    // Auto-populate existing preferences and add empty entry for new ones
    if (patient.preferences && Object.keys(patient.preferences).length > 0) {
      const existingPreferences = Object.entries(patient.preferences).map(([key, value], index) => ({
        id: `existing-${index}`,
        key,
        value,
        isCustom: !basePreferenceKeyOptions.some(option => option.value === key),
        customKey: !basePreferenceKeyOptions.some(option => option.value === key) ? key : ''
      }))
      
      // Add one empty entry for new preferences with a safe numeric ID
      const newId = '1000' // Use a high number to avoid conflicts with existing-X IDs
      const allPreferences = [
        ...existingPreferences,
        { id: newId, key: '', value: '', isCustom: false, customKey: '' }
      ]
      
      setPreferences(allPreferences)
    } else {
      // No existing preferences, just set default empty entry
      setPreferences([{ id: '1', key: '', value: '', isCustom: false, customKey: '' }])
    }
  }

  const handleSubmit = async () => {
    if (!isFormValid()) return

    setCurrentPage('submitting')
    
    let patientHasBeenAdded = false
    
    try {
      // Build payload based on patient type
      const basePayload = {
        medical_number: medicalNumber.trim(),
        referral_department: referralDepartment,
        referral_date: referralDate,
        referral_notes: referralNotes.trim(),
        auto_grade: gradePatient,
        prefers_evening: prefersEvening
      }

      let payload
      if (isNewPatient) {
        // For new patients, include all fields
        const validMedicalHistory = medicalHistory.filter(h => h.date && h.entry.trim())
        const formattedPreferences = getFormattedPreferences()
        
        payload = {
          ...basePayload,
          date_of_birth: dateOfBirth,
          postcode: postcode.trim(),
          medical_history: validMedicalHistory.map(h => ({
            date: h.date,
            notes: h.entry.trim()
          })),
          preferences: Object.keys(formattedPreferences).length > 0 ? formattedPreferences : undefined
        }
      } else {
        // For existing patients, include referral fields and preferences
        const formattedPreferences = getFormattedPreferences()
        
        payload = {
          ...basePayload,
          preferences: Object.keys(formattedPreferences).length > 0 ? formattedPreferences : undefined
        }
      }
      
      const newPatient = await addPatient(
        payload,
        // onPatientAdded callback - called when patient is added
        (addedPatient) => {
          patientHasBeenAdded = true // Mark that patient was successfully added
          
          // Set grading_status to "GRADING" if auto_grade is true
          const patientWithStatus = {
            ...addedPatient,
            grading_status: gradePatient ? 'GRADING' as const : addedPatient.grading_status
          }
          
          setCurrentPatient(patientWithStatus)
          // Transition from submitting to patient modal
          setCurrentPage('patient-modal')
        },
        // onPatientGraded callback - called when grading completes
        (gradedPatient) => {
          // Update the current patient with graded results
          setCurrentPatient(gradedPatient)
        },
        // onGradingFailed callback - called if grading fails
        (message) => {
          console.warn('Patient grading failed:', message)
          // Store the grading error message and show grading error page
          setGradingError(message)
          // Keep the patient but mark grading as failed
          setCurrentPatient(prev => prev ? {
            ...prev,
            grading_status: 'FAILED' as const
          } : null)
          // Transition to grading error page
          setCurrentPage('grading-error')
        }
      )
      
      // For non-auto-grade patients, set up the patient directly
      if (!gradePatient) {
        setCurrentPatient(newPatient)
        setCurrentPage('patient-modal')
      }
    } catch (error) {
      console.error('Failed to add patient:', error)
      
      // Check if the patient was already added (we're in patient modal)
      if (patientHasBeenAdded) {
        // This is a grading failure (network error, chunked encoding error, etc.)
        setGradingError(`Network error during grading: ${error instanceof Error ? error.message : 'Unknown error'}`)
        // Keep the patient but mark grading as failed
        setCurrentPatient(prev => prev ? {
          ...prev,
          grading_status: 'FAILED' as const
        } : null)
        // Transition to grading error page
        setCurrentPage('grading-error')
      } else {
        // This is a patient creation failure
        setSubmitError('Failed to add patient. Please try again.')
        setCurrentPage('error')
      }
    }
  }

  const handleClose = (shouldRefresh = false) => {
    setCurrentPage('form')
    onClose(shouldRefresh)
  }

  const handlePatientModalClose = () => {
    // When patient modal closes, call the parent callback and close this modal
    if (onPatientCreated && currentPatient) {
      onPatientCreated(currentPatient)
    }
    handleClose(true) // Refresh the waitlist table
  }


  const renderFormPage = () => (
    <div className="space-y-6">
      {/* Required Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 relative">
          <Label htmlFor="medical-number" className="text-base font-medium">Medical Number *</Label>
          <div className="relative">
            <Input
              id="medical-number"
              value={medicalNumber}
              onChange={handleMedicalNumberChange}
              placeholder="Medical number..."
              className={`font-mono ${medicalNumber && !isValidMedicalNumber(medicalNumber) ? 'border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20' : ''} ${selectedPatient ? 'bg-green-50 border-green-300' : ''}`}
              maxLength={10}
              disabled={!isNewPatient && selectedPatient !== null}
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              </div>
            )}
          </div>
          
          {selectedPatient && (
            <div className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded text-sm">
              <span className="text-green-700">
                Existing patient selected: {selectedPatient.medical_number}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedPatient(null)
                  setIsNewPatient(true)
                  setMedicalNumber('')
                  setDateOfBirth('')
                  setPostcode('')
                  setMedicalHistory([{ id: '1', date: '', entry: '' }])
                  setPreferences([{ id: '1', key: '', value: '', isCustom: false, customKey: '' }])
                  setPrefersEvening(false)
                }}
                className="text-green-700 hover:text-green-800 h-6 px-2"
              >
                Clear
              </Button>
            </div>
          )}
          
          {searchResults.length > 0 && !selectedPatient && (
            <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1">
              {searchResults.map((patient) => (
                <button
                  key={patient.waitlist_id}
                  type="button"
                  onClick={() => handleSelectPatient(patient)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b last:border-b-0 font-mono text-sm"
                >
                  {patient.medical_number}
                </button>
              ))}
            </div>
          )}
          
          {medicalNumber && !isValidMedicalNumber(medicalNumber) && searchResults.length === 0 && !isSearching && (
            <p className="text-sm text-red-600">
              Medical Number must be exactly 10 digits and cannot start with 0
            </p>
          )}
        </div>
        <div className="space-y-2">
          <DatePicker
            label="Date of Birth *"
            value={dateOfBirth}
            onChange={setDateOfBirth}
            placeholder="Select date of birth"
            className="w-full"
            disabled={!isNewPatient}
            labelClassName="text-base font-medium"
          />
          {!isNewPatient && (
            <p className="text-xs text-muted-foreground">
              Auto-filled from existing patient record
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="postcode" className="text-base font-medium">Postcode</Label>
          <Input
            id="postcode"
            value={postcode}
            onChange={(e) => {
              const value = e.target.value.toUpperCase().replace(/[^A-Z0-9\s]/g, '')
              setPostcode(value)
            }}
            placeholder="Enter postcode..."
            className={`font-mono ${!isNewPatient ? 'bg-gray-50 text-gray-600' : ''} ${postcode && !isValidPostcode(postcode) ? 'border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20' : ''}`}
            disabled={!isNewPatient}
          />
          {postcode && !isValidPostcode(postcode) && isNewPatient && (
            <p className="text-sm text-red-600">
              Please enter a valid UK postcode
            </p>
          )}
          {!isNewPatient && (
            <p className="text-xs text-muted-foreground">
              Auto-filled from existing patient record
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Select
            label="Referral Department *"
            value={referralDepartment}
            onChange={setReferralDepartment}
            options={departmentOptions}
            placeholder="Select department..."
            className="w-full"
            labelClassName="text-base font-medium"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <DatePicker
            label="Referral Date *"
            value={referralDate}
            onChange={setReferralDate}
            placeholder="Select referral date"
            className="w-full"
            labelClassName="text-base font-medium"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="referral-notes" className="text-base font-medium">Referral Notes *</Label>
        <Textarea
          id="referral-notes"
          value={referralNotes}
          onChange={(e) => setReferralNotes(e.target.value)}
          placeholder="Enter referral notes..."
          rows={3}
        />
      </div>

      {/* Medical History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium">
            Medical History
            {!isNewPatient && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                (Auto-filled from existing patient record)
              </span>
            )}
          </Label>
          {isNewPatient && (
            <Button
              type="button"
              onClick={handleAddMedicalHistory}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Entry
            </Button>
          )}
        </div>
        
        <div className="space-y-3">
          {medicalHistory.map((entry) => (
            <Card key={entry.id} className="p-4">
              <CardContent className="p-0">
                <div className="flex items-start gap-4">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <DatePicker
                        label="Date"
                        value={entry.date}
                        onChange={(value) => updateMedicalHistory(entry.id, 'date', value)}
                        placeholder="Select date"
                        className="w-full"
                        disabled={!isNewPatient}
                        labelClassName="text-base font-medium"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-3">
                      <Label htmlFor={`history-entry-${entry.id}`} className="text-base font-medium">Medical Entry</Label>
                      <Input
                        id={`history-entry-${entry.id}`}
                        value={entry.entry}
                        onChange={(e) => updateMedicalHistory(entry.id, 'entry', e.target.value)}
                        placeholder="Enter medical history entry..."
                        disabled={!isNewPatient}
                        className={!isNewPatient ? 'bg-gray-50 text-gray-600' : ''}
                      />
                    </div>
                  </div>
                  {medicalHistory.length > 1 && isNewPatient && (
                    <Button
                      type="button"
                      onClick={() => handleRemoveMedicalHistory(entry.id)}
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
          ))}
        </div>
      </div>

      {/* Patient Preferences */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base font-medium">Patient Preferences</Label>
            {hasDuplicateKeys() && (
              <p className="text-sm text-red-600 mt-1">
                Duplicate preference keys are not allowed
              </p>
            )}
            {hasIncompletePreferences() && (
              <p className="text-sm text-red-600 mt-1">
                The following preferences need values: {getIncompletePreferences().join(', ')}
              </p>
            )}
          </div>
          <Button
            type="button"
            onClick={handleAddPreference}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Preference
          </Button>
        </div>
        
        <div className="space-y-3">
          {preferences.map((entry) => {
            const isExisting = entry.id.startsWith('existing-')
            const hasKey = entry.isCustom ? (entry.customKey && entry.customKey.trim()) : (entry.key && entry.key.trim())
            const hasValue = entry.value && entry.value.trim()
            const isIncomplete = hasKey && !hasValue
            const hasDuplicateKey = wouldCreateDuplicate(entry.customKey || '', entry.id) || hasDuplicateKeys()
            
            return (
              <Card key={entry.id} className={`p-4 ${hasDuplicateKey || isIncomplete ? 'border-red-200' : ''} ${isExisting ? 'bg-blue-50/30 border-blue-200' : ''}`}>
                <CardContent className="p-0">
                  {isExisting && (
                    <div className="mb-3 text-xs text-blue-700 font-medium">
                      Existing Preference
                    </div>
                  )}
                  {isIncomplete && (
                    <div className="mb-3 text-xs text-red-700 font-medium">
                      This preference needs a value
                    </div>
                  )}
                  <div className="flex items-start gap-4">
                    <div className="flex-1 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`preference-key-${entry.id}`} className="text-base font-medium">Preference Type</Label>
                        <Select
                          value={entry.key}
                          onChange={(value) => updatePreference(entry.id, 'key', value)}
                          options={getAvailablePreferenceOptions(entry.id)}
                          placeholder="Select preference type..."
                          className="w-full"
                          openUpwards={true}
                          hideEmpty={true}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`preference-value-${entry.id}`} className="text-base font-medium">Value</Label>
                        <Input
                          id={`preference-value-${entry.id}`}
                          value={entry.value}
                          onChange={(e) => updatePreference(entry.id, 'value', e.target.value)}
                          placeholder="Enter preference value..."
                          className={isIncomplete ? 'border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20' : ''}
                        />
                      </div>
                    </div>
                    
                    {/* Custom key input when "Other" is selected */}
                    {entry.isCustom && (
                      <div className="border-t pt-4">
                        <div className="space-y-2">
                          <Label htmlFor={`preference-custom-key-${entry.id}`} className="text-base font-medium">Custom Preference Key</Label>
                          <Input
                            id={`preference-custom-key-${entry.id}`}
                            value={entry.customKey || ''}
                            onChange={(e) => updatePreference(entry.id, 'customKey', e.target.value)}
                            placeholder="Enter custom preference key"
                            className={wouldCreateDuplicate(entry.customKey || '', entry.id) ? 'border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20' : ''}
                          />
                          {wouldCreateDuplicate(entry.customKey || '', entry.id) && (
                            <p className="text-sm text-red-600">
                              This key already exists in another preference
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {preferences.length > 1 && (
                    <Button
                      type="button"
                      onClick={() => handleRemovePreference(entry.id)}
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

      {/* Evening Contact Preference */}
      <div className="flex items-center space-x-2 p-4 bg-gray-50 rounded-lg border">
        <Checkbox
          id="evening-contact"
          checked={prefersEvening}
          onCheckedChange={(checked) => setPrefersEvening(checked as boolean)}
        />
        <Label
          htmlFor="evening-contact"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Prefers being contacted in the evening
        </Label>
      </div>

      {/* Submit Options */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="grade-patient"
            checked={gradePatient}
            onCheckedChange={(checked) => setGradePatient(checked as boolean)}
          />
          <Label
            htmlFor="grade-patient"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Auto-grade patient
          </Label>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={!isFormValid()}
          className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Submit
        </Button>
      </div>
    </div>
  )

  const renderSubmittingPage = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      <div className="text-lg font-medium">Adding patient...</div>
      <div className="text-sm text-muted-foreground">Please wait while we process your request</div>
    </div>
  )


  const renderErrorPage = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-6">
      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
        <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <div className="text-center space-y-2">
        <div className="text-xl font-semibold text-red-800">
          Failed to Add Patient
        </div>
        <div className="text-sm text-muted-foreground">
          {submitError || 'There was an issue adding the patient. Please try again.'}
        </div>
      </div>
      <div className="flex gap-2">
        <Button 
          onClick={() => setCurrentPage('form')}
          variant="outline"
          className="cursor-pointer"
        >
          Try Again
        </Button>
        <Button 
          onClick={() => handleClose()}
          className="bg-red-600 hover:bg-red-700 text-white cursor-pointer"
        >
          Close
        </Button>
      </div>
    </div>
  )

  const renderGradingErrorPage = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-6">
      <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
        <svg className="h-8 w-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <div className="text-center space-y-2">
        <div className="text-xl font-semibold text-amber-800">
          Grading Failed
        </div>
        <div className="text-sm text-muted-foreground">
          The patient was successfully added to the waitlist, but automatic grading failed.
        </div>
        <div className="text-sm text-red-600 mt-4">
          {gradingError || 'There was an issue grading the patient automatically.'}
        </div>
      </div>
      <div className="flex gap-2">
        <Button 
          onClick={() => setCurrentPage('patient-modal')}
          variant="outline"
          className="cursor-pointer"
        >
          Back to Patient
        </Button>
        <Button 
          onClick={handlePatientModalClose}
          className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
        >
          Continue
        </Button>
      </div>
    </div>
  )

  return (
    <>
      <Dialog 
        open={isOpen && currentPage !== 'patient-modal'} 
        onOpenChange={currentPage === 'submitting' ? undefined : handleClose}
      >
        <DialogContent 
          className="max-w-3xl max-h-[90vh] overflow-y-auto"
          showCloseButton={currentPage !== 'submitting'}
        >
          <DialogHeader className="pb-4">
            <DialogTitle className="text-2xl font-bold text-primary">
              {currentPage === 'form' && 'Add New Patient'}
              {currentPage === 'submitting' && 'Adding Patient'}
              {currentPage === 'error' && 'Error Adding Patient'}
              {currentPage === 'grading-error' && 'Grading Failed'}
            </DialogTitle>
          </DialogHeader>

          {currentPage === 'form' && renderFormPage()}
          {currentPage === 'submitting' && renderSubmittingPage()}
          {currentPage === 'error' && renderErrorPage()}
          {currentPage === 'grading-error' && renderGradingErrorPage()}
        </DialogContent>
      </Dialog>

      <PatientModal
        isOpen={currentPage === 'patient-modal'}
        onClose={handlePatientModalClose}
        patient={currentPatient}
        onPatientUpdate={(updatedPatient) => {
          setCurrentPatient(updatedPatient)
        }}
      />
    </>
  )
}