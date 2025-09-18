import { Skeleton } from "@/components/ui/skeleton"

export function AppLayoutSkeleton() {
  return (
    <div className="min-h-screen bg-background" suppressHydrationWarning>
      {/* Mobile Layout Skeleton */}
      <div className="md:hidden" suppressHydrationWarning>
        {/* Mobile Navbar */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-background border-b px-4 py-3" suppressHydrationWarning>
          <div className="flex items-center justify-between" suppressHydrationWarning>
            <Skeleton className="h-6 w-32" suppressHydrationWarning />
            <Skeleton className="h-8 w-16" suppressHydrationWarning />
          </div>
        </div>
        
        {/* Mobile Content */}
        <main className="pt-16 pb-20 p-4" suppressHydrationWarning>
          <div className="space-y-6" suppressHydrationWarning>
            <Skeleton className="h-8 w-48" suppressHydrationWarning />
            <div className="space-y-4" suppressHydrationWarning>
              <div className="rounded-lg border p-4" suppressHydrationWarning>
                <Skeleton className="h-4 w-full mb-2" suppressHydrationWarning />
                <Skeleton className="h-4 w-3/4" suppressHydrationWarning />
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Desktop Layout Skeleton */}
      <div className="hidden md:flex" suppressHydrationWarning>
        {/* Sidebar */}
        <div className="w-64 border-r bg-background" suppressHydrationWarning>
          <div className="p-6 border-b" suppressHydrationWarning>
            <Skeleton className="h-6 w-40" suppressHydrationWarning />
          </div>
          <div className="p-4 space-y-2" suppressHydrationWarning>
            <div className="flex items-center space-x-2 p-2" suppressHydrationWarning>
              <Skeleton className="h-4 w-4" suppressHydrationWarning />
              <Skeleton className="h-4 w-24" suppressHydrationWarning />
            </div>
            <div className="flex items-center space-x-2 p-2" suppressHydrationWarning>
              <Skeleton className="h-4 w-4" suppressHydrationWarning />
              <Skeleton className="h-4 w-24" suppressHydrationWarning />
            </div>
            <div className="flex items-center space-x-2 p-2" suppressHydrationWarning>
              <Skeleton className="h-4 w-4" suppressHydrationWarning />
              <Skeleton className="h-4 w-24" suppressHydrationWarning />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1" suppressHydrationWarning>
          <main className="p-6" suppressHydrationWarning>
            <div className="max-w-7xl space-y-6" suppressHydrationWarning>
              <div className="flex items-center justify-between" suppressHydrationWarning>
                <Skeleton className="h-8 w-48" suppressHydrationWarning />
              </div>
              
              <div className="grid gap-4" suppressHydrationWarning>
                <div className="rounded-lg border p-6" suppressHydrationWarning>
                  <Skeleton className="h-4 w-full mb-3" suppressHydrationWarning />
                  <Skeleton className="h-4 w-2/3 mb-3" suppressHydrationWarning />
                  <Skeleton className="h-4 w-1/2" suppressHydrationWarning />
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}