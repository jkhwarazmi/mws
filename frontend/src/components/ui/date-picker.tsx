"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Calendar, X } from "lucide-react"

interface DatePickerProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  labelClassName?: string
}

export function DatePicker({ 
  label, 
  value, 
  onChange, 
  placeholder = "Select date",
  className = "",
  disabled = false,
  labelClassName = ""
}: DatePickerProps) {
  const handleClear = () => {
    onChange("")
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return ""
    try {
      // Return YYYY-MM-DD format
      if (dateString.includes("T")) {
        return dateString.split("T")[0]
      }
      const date = new Date(dateString)
      return date.toISOString().split("T")[0]
    } catch {
      return ""
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    onChange(value)
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor={`date-${label}`} className={`text-sm font-medium ${labelClassName}`}>
        {label}
      </Label>
      <div className="relative">
        <Input
          id={`date-${label}`}
          type="date"
          value={formatDate(value)}
          onChange={handleChange}
          placeholder={placeholder}
          className="pr-8 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-8 [&::-webkit-calendar-picker-indicator]:h-8 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
          disabled={disabled}
        />
        {!value && (
          <Calendar className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 pointer-events-none" />
        )}
        {value && !disabled && (
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