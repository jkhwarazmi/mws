"use client"

import { CheckCircle, XCircle, AlertCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface AssignmentResult {
  successful: number
  failed: number
}

interface AssignmentResultsModalProps {
  isOpen: boolean
  onClose: (assignmentData?: { success: boolean; waitlist_id?: string }) => void
  result: AssignmentResult | null
  type: "auto-assign" | "assign-selected"
  assignmentData?: { success: boolean; waitlist_id?: string }
}

export function AssignmentResultsModal({
  isOpen,
  onClose,
  result,
  type,
  assignmentData
}: AssignmentResultsModalProps) {
  if (!result) return null

  const total = result.successful + result.failed
  const isAllSuccessful = result.failed === 0
  const isAllFailed = result.successful === 0

  const getTitle = () => {
    if (type === "auto-assign") {
      return "Auto-Assignment Complete"
    }
    return "Assignment Complete"
  }

  const getIcon = () => {
    if (isAllSuccessful) {
      return <CheckCircle className="h-6 w-6 text-green-600" />
    }
    if (isAllFailed) {
      return <XCircle className="h-6 w-6 text-red-600" />
    }
    return <AlertCircle className="h-6 w-6 text-yellow-600" />
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md" 
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            {getIcon()}
            <DialogTitle>{getTitle()}</DialogTitle>
          </div>
          <DialogDescription>
            Assignment process has finished with the following results:
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
              <div className="text-2xl font-bold text-green-700">
                {result.successful}
              </div>
              <div className="text-sm text-green-600 font-medium">
                Successful
              </div>
            </div>
            
            <div className="text-center p-4 rounded-lg bg-red-50 border border-red-200">
              <div className="text-2xl font-bold text-red-700">
                {result.failed}
              </div>
              <div className="text-sm text-red-600 font-medium">
                Failed
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>Total appointments processed:</span>
            <Badge variant="outline">{total}</Badge>
          </div>
          
          {result.failed > 0 && (
            <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200">
              <div className="text-sm text-yellow-800">
                <strong>Note:</strong> Some appointments could not be assigned. 
                This may be due to no available waitlist patients matching the criteria 
                or system constraints. Please try again later.
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button 
            onClick={() => onClose(assignmentData)}
            className="w-full"
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}