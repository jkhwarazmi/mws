"use client"

import * as React from "react"
import { ChevronDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  label?: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  emptyLabel?: string
  hideEmpty?: boolean
  openUpwards?: boolean
  labelClassName?: string
}

export function Select({
  label,
  value,
  onChange,
  options,
  placeholder = "Select an option...",
  className = "",
  emptyLabel = "All",
  hideEmpty = false,
  openUpwards = false,
  labelClassName = ""
}: SelectProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const selectRef = React.useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedOption = options.find(option => option.value === value)
  const displayValue = selectedOption ? selectedOption.label : value ? `ID: ${value}` : ""

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange("")
    setIsOpen(false)
  }

  const handleSelect = (optionValue: string) => {
    onChange(optionValue)
    setIsOpen(false)
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <Label htmlFor={`select-${label}`} className={`text-sm font-medium ${labelClassName}`}>
          {label}
        </Label>
      )}
      <div ref={selectRef} className="relative">
        <div className="relative">
          <button
            id={label ? `select-${label}` : undefined}
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className={cn(
              "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors",
              "placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
              value ? "text-foreground" : "text-muted-foreground",
              value && "pr-12"
            )}
          >
            <span className="truncate">
              {displayValue || placeholder}
            </span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
          </button>
          
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-7 top-1/2 -translate-y-1/2 h-4 w-4 p-0 hover:bg-accent/50 rounded-sm transition-colors flex items-center justify-center"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {isOpen && (
          <div className={cn(
            "absolute z-50 w-full rounded-md border bg-popover shadow-lg",
            openUpwards ? "bottom-full mb-1" : "top-full mt-1"
          )}>
            <div className="max-h-60 overflow-auto p-1">
              {/* Empty/All option */}
              {!hideEmpty && (
                <button
                  type="button"
                  onClick={() => handleSelect("")}
                  className={cn(
                    "w-full rounded-sm px-2 py-1.5 text-left text-sm transition-colors",
                    !value 
                      ? "bg-primary text-primary-foreground hover:bg-primary" 
                      : "hover:bg-accent"
                  )}
                >
                  {emptyLabel}
                </button>
              )}
              
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "w-full rounded-sm px-2 py-1.5 text-left text-sm transition-colors",
                    value === option.value 
                      ? "bg-primary text-primary-foreground hover:bg-primary" 
                      : "hover:bg-accent"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 