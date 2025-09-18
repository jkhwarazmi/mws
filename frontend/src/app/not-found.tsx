import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Medical Waitlist Management - Page Not Found",
  description: "The requested page could not be found",
}

export default function NotFound() {
  return (
    <div className="space-y-6 w-full max-w-full min-h-[60vh] flex flex-col items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold text-primary">404</h1>
        <h2 className="text-3xl font-bold text-primary">Page Not Found</h2>
        <p className="text-muted-foreground text-lg max-w-md">
          The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </p>
      </div>
    </div>
  )
}