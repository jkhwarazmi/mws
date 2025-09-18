"use client"

import { forwardRef } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

interface NumberInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  min?: number
  max?: number
  step?: number
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ label, value, onChange, placeholder, className = "", min, max, step = 0.1 }, ref) => {
    const handleClear = () => {
      onChange("")
    }

    return (
      <div className={`space-y-2 ${className}`}>
        <Label htmlFor={`number-${label}`} className="text-sm font-medium">
          {label}
        </Label>
        <div className="relative">
          <Input
            ref={ref}
            id={`number-${label}`}
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="pr-10"
            min={min}
            max={max}
            step={step}
          />
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
)

NumberInput.displayName = "NumberInput" 