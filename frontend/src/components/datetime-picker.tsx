"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Calendar, X } from "lucide-react"

interface DateTimePickerProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  labelClassName?: string
  min?: string
}

export function DateTimePicker({ 
  label, 
  value, 
  onChange, 
  placeholder = "Select date and time",
  className = "",
  labelClassName = "text-sm font-medium",
  min
}: DateTimePickerProps) {
  const handleClear = () => {
    onChange("")
  }

  const formatDateTimeLocal = (dateString: string) => {
    if (!dateString) return ""
    try {
      if (dateString.includes("T") && !dateString.includes("+") && !dateString.includes("Z")) {
        return dateString.slice(0, 16)
      } else {
        const date = new Date(dateString)
        return date.toISOString().slice(0, 16)
      }
    } catch {
      return ""
    }
  }

  // Convert datetime-local value back to API format
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value) {
      onChange(value + ":00")
    } else {
      onChange("")
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor={`datetime-${label}`} className={labelClassName}>
        {label}
      </Label>
      <div className="relative">
        <Input
          id={`datetime-${label}`}
          type="datetime-local"
          value={formatDateTimeLocal(value)}
          onChange={handleChange}
          placeholder={placeholder}
          className="pr-8 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-8 [&::-webkit-calendar-picker-indicator]:h-8 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
          min={min ? formatDateTimeLocal(min) : undefined}
        />
        {!value && (
          <Calendar className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 pointer-events-none" />
        )}
        {value && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
} 