import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { SearchInput } from "@/components/search-input"
import { DatePicker } from "@/components/ui/date-picker"
import { Select } from "@/components/ui/select"
import { NumberInput } from "@/components/ui/number-input"
import { useIsMobile } from "@/hooks/use-mobile"
import { RefreshCw, UserPlus, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"

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

// Disabled Sortable column header component for skeleton
function DisabledSortableColumnHeader({
  children,
  className,
  field,
  orderBy,
  orderDir
}: {
  children: React.ReactNode
  className?: string
  field?: string
  orderBy?: string
  orderDir?: string
}) {
  const isActive = orderBy === field
  const currentDirection = isActive ? orderDir : 'none'
  
  const getSortIcon = () => {
    if (!isActive) return <ArrowUpDown className="h-4 w-4 opacity-50" />
    if (currentDirection === 'asc') return <ArrowUp className="h-4 w-4 opacity-50" />
    if (currentDirection === 'desc') return <ArrowDown className="h-4 w-4 opacity-50" />
    return <ArrowUpDown className="h-4 w-4 opacity-50" />
  }
  
  return (
    <TableHead
      className={`cursor-default select-none opacity-50 ${className || ''}`}
    >
      <div className="flex items-center gap-1">
        {children}
        {getSortIcon()}
      </div>
    </TableHead>
  )
}

// Filter Section with Disabled Controls
function DisabledFilterSection() {
  // Empty department options for skeleton
  const departmentOptions: { value: string; label: string }[] = []
  
  return (
    <div className="bg-muted/5 p-6 rounded-lg border space-y-6 opacity-60">
      {/* Search Fields Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <SearchInput
          label="Medical Number"
          placeholder="Enter Medical number..."
          onSearch={() => {}}
          debounceMs={300}
          className="w-full opacity-50 pointer-events-none"
          value=""
        />
        <SearchInput
          label="Postcode"
          placeholder="Enter postcode..."
          onSearch={() => {}}
          debounceMs={300}
          className="w-full opacity-50 pointer-events-none"
          value=""
        />
        <Select
          label="Department"
          value=""
          onChange={() => {}}
          options={departmentOptions}
          placeholder="Select department..."
          emptyLabel="All Departments"
          className="w-full opacity-50 pointer-events-none"
        />
      </div>
      
      {/* Priority & Severity Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Select
          label="Clinical Urgency"
          value=""
          onChange={() => {}}
          options={URGENCY_SEVERITY_OPTIONS}
          placeholder="Select urgency..."
          emptyLabel="All Urgencies"
          className="w-full opacity-50 pointer-events-none"
        />
        <Select
          label="Condition Severity"
          value=""
          onChange={() => {}}
          options={URGENCY_SEVERITY_OPTIONS}
          placeholder="Select severity..."
          emptyLabel="All Severities"
          className="w-full opacity-50 pointer-events-none"
        />
        <NumberInput
          label="Min. Comorbidities"
          value=""
          onChange={() => {}}
          placeholder="0.0"
          className="w-full opacity-50 pointer-events-none"
          min={0}
          max={1}
          step={0.1}
        />
      </div>
      
      {/* Dates & Status Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <DatePicker
          label="Min. Referral Date"
          value=""
          onChange={() => {}}
          placeholder="Start date"
          className="w-full"
          labelClassName="opacity-50"
          disabled
        />
        <DatePicker
          label="Max. Referral Date"
          value=""
          onChange={() => {}}
          placeholder="End date"
          className="w-full"
          labelClassName="opacity-50"
          disabled
        />
        <Select
          label="Grading Status"
          value=""
          onChange={() => {}}
          options={GRADING_STATUS_OPTIONS}
          placeholder="Select grading..."
          emptyLabel="All"
          className="w-full opacity-50 pointer-events-none"
        />
        <Select
          label="Assignment Status"
          value=""
          onChange={() => {}}
          options={ASSIGNMENT_STATUS_OPTIONS}
          placeholder="Select assignment..."
          emptyLabel="All"
          className="w-full opacity-50 pointer-events-none"
        />
      </div>
    </div>
  )
}

// Action Buttons Skeleton
function ActionButtonsSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col">
        <Button
          disabled
          variant="outline"
          size="sm"
          className="self-start cursor-not-allowed"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
        <div className="text-xs text-muted-foreground mt-1 h-4 flex items-center">
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          disabled
          variant="default"
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 cursor-not-allowed opacity-50"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Add Patient
        </Button>
      </div>
    </div>
  )
}


export function WaitlistTableSkeleton() {
  const isMobile = useIsMobile()
  
  // Get sorting parameters from URL to match the current state
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const orderBy = searchParams.get('order_by') || ''
  const orderDir = searchParams.get('order_dir') || 'asc'
  
  return (
    <div className="w-full space-y-4">
      {/* Filter Section */}
      <div className="space-y-4">
        <DisabledFilterSection />
        
        {/* Placeholder for "Found X patients..." text */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground h-5 flex items-center">
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <ActionButtonsSkeleton />

      {/* Conditionally render mobile or desktop loading state */}
      {isMobile ? (
        /* Mobile Loading Cards */
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index} className="p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </div>
          </Card>
          ))}
        </div>
      ) : (
        /* Desktop Loading Table */
        <div className="w-full overflow-x-auto rounded-lg border shadow-sm">
        <Table className="min-w-[1200px]">
          <TableHeader>
            <TableRow className="bg-muted/30 border-b-2 border-border hover:bg-muted/30">
              <TableHead className="w-1/8 opacity-50">Medical Number</TableHead>
              <DisabledSortableColumnHeader 
                className="w-1/8"
                field="date_of_birth"
                orderBy={orderBy}
                orderDir={orderDir}
              >
                Date of Birth
              </DisabledSortableColumnHeader>
              <TableHead className="w-1/8 opacity-50">Postcode</TableHead>
              <TableHead className="w-1/8 opacity-50">Department</TableHead>
              <DisabledSortableColumnHeader 
                className="w-1/8"
                field="referral_date"
                orderBy={orderBy}
                orderDir={orderDir}
              >
                Referral Date
              </DisabledSortableColumnHeader>
              <DisabledSortableColumnHeader 
                className="w-1/8 text-center"
                field="clinical_urgency"
                orderBy={orderBy}
                orderDir={orderDir}
              >
                Clinical Urgency
              </DisabledSortableColumnHeader>
              <DisabledSortableColumnHeader 
                className="w-1/8 text-center"
                field="condition_severity"
                orderBy={orderBy}
                orderDir={orderDir}
              >
                Condition Severity
              </DisabledSortableColumnHeader>
              <DisabledSortableColumnHeader 
                className="w-1/8 text-center"
                field="comorbidities"
                orderBy={orderBy}
                orderDir={orderDir}
              >
                Comorbidities
              </DisabledSortableColumnHeader>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 20 }).map((_, index) => (
              <TableRow 
                key={index} 
                className={`border-b border-border/50 ${
                  index % 2 === 0 ? 'bg-muted/20' : 'bg-background'
                }`}
              >
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell className="text-center"><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                <TableCell className="text-center"><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                <TableCell className="text-center"><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      )}

    </div>
  )
} 