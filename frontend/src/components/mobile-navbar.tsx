"use client"

import { Calendar, Users, Home, Menu, LogOut } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { signOut } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

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

export function MobileNavbar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const { user } = useAuth()

  const handleLogout = async () => {
    try {
      await signOut(auth)
      setIsOpen(false)
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 hover:bg-accent/10 transition-colors rounded-md p-1 -m-1">
          <div className="h-8 w-8 rounded bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">Medical</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">Medical Waitlist</span>
            <span className="text-xs text-muted-foreground">Management</span>
          </div>
        </Link>

        {/* Mobile Menu */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[250px]">
            <SheetHeader>
              <SheetTitle>Navigation</SheetTitle>
              <SheetDescription>
                Navigate through the Medical Waitlist Management System
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-2">
              {items.map((item) => (
                <Link
                  key={item.title}
                  href={item.url}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    pathname === item.url
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-primary/10"
                  }`}
                  onClick={() => setIsOpen(false)}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              ))}
            </div>
            <div className="mt-8 pt-4 border-t border-border space-y-3">
              {user && (
                <div className="space-y-2 px-3">
                  <p className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </p>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-0 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
              <p className="text-xs text-muted-foreground px-3">
                Medical Waitlist Management v0.1
              </p>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Bottom navigation bar for mobile */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border md:hidden">
        <div className="flex items-center justify-around py-2">
          {items.map((item) => (
            <Link
              key={item.title}
              href={item.url}
              className={`flex flex-col items-center gap-1 p-2 rounded-md transition-colors min-w-[60px] ${
                pathname === item.url
                  ? "text-primary hover:text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs">{item.title}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
} 