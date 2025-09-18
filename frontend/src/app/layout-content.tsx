'use client'

import { usePathname } from 'next/navigation'
import { AppSidebar } from "@/components/app-sidebar"
import { MobileNavbar } from "@/components/mobile-navbar"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { useIsMobile } from "@/hooks/use-mobile"
import AuthGuard from "@/components/authGuard"

interface LayoutContentProps {
  children: React.ReactNode
}

export function LayoutContent({ children }: LayoutContentProps) {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const isLoginPage = pathname === '/login'

  if (isLoginPage) {
    return <>{children}</>
  }

  return (
    <AuthGuard>
      {isMobile ? (
        /* Mobile Layout */
        <div>
          <MobileNavbar />
          <main className="pt-16 pb-20 p-4 min-h-screen">
            {children}
          </main>
        </div>
      ) : (
        /* Desktop Layout */
        <div>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <main className="flex-1 p-6 w-full max-w-7xl overflow-hidden">
                {children}
              </main>
            </SidebarInset>
          </SidebarProvider>
        </div>
      )}
    </AuthGuard>
  )
}