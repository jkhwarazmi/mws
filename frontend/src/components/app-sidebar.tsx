"use client"

import { Calendar, Users, Home, LogOut } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { useAuth } from "@/context/AuthContext"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar"

// Menu items with Medical blue styling
const items = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
  },
  {
    title: "Appointments",
    url: "/appointments",
    icon: Calendar,
  },
  {
    title: "Waitlist",
    url: "/waitlist",
    icon: Users,
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { user } = useAuth()

  const handleLogout = async () => {
    try {
      await signOut(auth)
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-border">
        <Link href="/" className="flex items-center gap-2 px-4 py-3 hover:bg-accent/10 transition-colors rounded-md">
          <div className="h-8 w-8 rounded bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">Medical</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">Medical Waitlist</span>
            <span className="text-xs text-muted-foreground">Management System</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={pathname === item.url}
                    className="hover:bg-primary/10 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-border">
        <div className="px-4 py-3 space-y-3">
          {user && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground truncate">
                {user.email}
              </p>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/10 rounded transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Medical Waitlist Management v0.1
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
} 