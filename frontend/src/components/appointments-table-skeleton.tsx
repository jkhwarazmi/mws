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
import { DateTimePicker } from "@/components/datetime-picker"
import { Select } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { useIsMobile } from "@/hooks/use-mobile"
import { RefreshCw, Calendar, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"

// Disabled Sortable column header component for appointments skeleton
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

// Filter Section with Disabled Controls for Appointments
function DisabledAppointmentsFilterSection() {
  // Empty options for skeleton
  const hospitalOptions: { value: string; label: string }[] = []
  const departmentOptions: { value: string; label: string }[] = []
  
  return (
    <div className="bg-muted/5 p-6 rounded-lg border space-y-6 opacity-60">
      {/* Search Fields Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <SearchInput
          label="Search by Appointment ID"
          placeholder="Enter appointment ID..."
          onSearch={() => {}}
          debounceMs={300}
          className="w-full opacity-50 pointer-events-none"
          value=""
        />
        <SearchInput
          label="Search by Waitlist ID"
          placeholder="Enter waitlist ID..."
          onSearch={() => {}}
          debounceMs={300}
          className="w-full opacity-50 pointer-events-none"
          value=""
        />
        <Select
          label="Hospital"
          value=""
          onChange={() => {}}
          options={hospitalOptions}
          placeholder="Select hospital..."
          emptyLabel="All Hospitals"
          className="w-full opacity-50 pointer-events-none"
        />
      </div>
      
      {/* Date Time & Department Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <DateTimePicker
          label="From Date & Time"
          value=""
          onChange={() => {}}
          placeholder="Start date and time"
          className="w-full opacity-50 pointer-events-none"
        />
        <DateTimePicker
          label="To Date & Time"
          value=""
          onChange={() => {}}
          placeholder="End date and time"
          className="w-full opacity-50 pointer-events-none"
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
      
      {/* Checkbox Row */}
      <div className="grid grid-cols-1 gap-4">
        <div className="flex items-center space-x-2 opacity-50">
          <Checkbox
            id="show-only-open"
            checked={false}
            onCheckedChange={() => {}}
            disabled
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

// Action Buttons Skeleton for Appointments
function AppointmentsActionButtonsSkeleton() {
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
          className="bg-blue-600 hover:bg-blue-700 text-white cursor-not-allowed opacity-50"
        >
          <Calendar className="h-4 w-4 mr-2" />
          Add Appointment
        </Button>
        <Button
          disabled
          variant="default"
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white cursor-not-allowed opacity-50"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Auto-Assign Selected (0)
        </Button>
      </div>
    </div>
  )
}


export function AppointmentsTableSkeleton() {
  const isMobile = useIsMobile()
  
  // Get sorting parameters from URL to match the current state
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const orderBy = searchParams.get('order_by') || ''
  const orderDir = searchParams.get('order_dir') || 'asc'
  
  return (
    <div className="w-full space-y-4">
      {/* Filter Section */}
      <div className="space-y-4">
        <DisabledAppointmentsFilterSection />
        
        {/* Placeholder for "Found X appointments..." text */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground h-5 flex items-center">
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <AppointmentsActionButtonsSkeleton />

      {/* Conditionally render mobile or desktop loading state */}
      {isMobile ? (
        /* Mobile Loading Cards */
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div className="flex items-start gap-3">
                <Skeleton className="h-4 w-4" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-36" />
                </div>
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-24 rounded-full" />
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
              <TableHead className="w-[50px] opacity-50">
                <Skeleton className="h-4 w-4" />
              </TableHead>
              <TableHead className="w-[140px] opacity-50">Appointment ID</TableHead>
              <DisabledSortableColumnHeader 
                className="w-[160px]"
                field="appointment_time"
                orderBy={orderBy}
                orderDir={orderDir}
              >
                Appointment Time
              </DisabledSortableColumnHeader>
              <TableHead className="w-[140px] opacity-50">Waitlist ID</TableHead>
              <TableHead className="w-[120px] opacity-50">Department</TableHead>
              <TableHead className="w-[120px] opacity-50">Hospital</TableHead>
              <TableHead className="w-[100px] opacity-50">Status</TableHead>
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
                <TableCell>
                  <Skeleton className="h-4 w-4" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-[85px]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-[130px]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-[100px]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-[90px] rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-[100px] rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-[85px] rounded-full" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      )}

    </div>
  )
} 