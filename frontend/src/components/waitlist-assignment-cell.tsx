"use client"

import { Badge } from "@/components/ui/badge"
import { useCountdown } from "@/hooks/use-countdown"
import { RefreshCw } from "lucide-react"

interface WaitlistAssignmentCellProps {
  waitlistId: string | null
  assignAt: string | null
  compact?: boolean
}

export function WaitlistAssignmentCell({ waitlistId, assignAt, compact = false }: WaitlistAssignmentCellProps) {
  const countdown = useCountdown(assignAt)

  if (waitlistId) {
    return (
      <span className="font-mono text-sm">
        {waitlistId}
      </span>
    )
  }

  if (!assignAt) {
    return <Badge variant="secondary">Not Linked</Badge>
  }

  if (countdown && countdown.total > 0) {
    const formatCountdown = () => {
      if (countdown.days > 0) {
        return `${countdown.days}d ${countdown.hours}h ${countdown.minutes}m`
      } else if (countdown.hours > 0) {
        return `${countdown.hours}h ${countdown.minutes}m ${countdown.seconds}s`
      } else if (countdown.minutes > 0) {
        return `${countdown.minutes}m ${countdown.seconds}s`
      } else {
        return `${countdown.seconds}s`
      }
    }

    return (
      <div className={`text-sm text-orange-600 font-bold ${compact ? 'whitespace-nowrap' : 'w-48 min-w-48 whitespace-nowrap'}`}>
        {compact ? formatCountdown() : `Auto-Assigning in ${formatCountdown()}`}
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 text-sm text-green-600 font-bold ${compact ? 'whitespace-nowrap' : 'w-48 min-w-48 whitespace-nowrap'}`}>
      <RefreshCw className="h-4 w-4 animate-spin" />
      {compact ? 'Assigning' : 'Auto-Assigning'}
    </div>
  )
}