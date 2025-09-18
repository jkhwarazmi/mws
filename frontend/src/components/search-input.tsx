"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SearchInputProps {
  label?: string
  placeholder?: string
  onSearch: (value: string) => void
  debounceMs?: number
  className?: string
  value?: string
}

export function SearchInput({ 
  label,
  placeholder = "Search...", 
  onSearch, 
  debounceMs = 300,
  className = "",
  value: controlledValue = ""
}: SearchInputProps) {
  const [inputValue, setInputValue] = useState(controlledValue)
  const isTypingRef = useRef(false)

  useEffect(() => {
    if (!isTypingRef.current) {
      setInputValue(controlledValue)
    }
  }, [controlledValue])

  // Debounce the input value and trigger search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(inputValue)
      isTypingRef.current = false
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [inputValue, debounceMs, onSearch])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isTypingRef.current = true
    setInputValue(e.target.value)
  }

  const handleClear = () => {
    setInputValue("")
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <Label htmlFor={`search-${label}`} className="text-sm font-medium">
          {label}
        </Label>
      )}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          id={label ? `search-${label}` : undefined}
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          className="pl-10 pr-10"
        />
        {inputValue && (
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