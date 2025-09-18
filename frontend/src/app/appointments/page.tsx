import type { Metadata } from "next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppointmentsTable } from "@/components/appointments-table";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Medical Waitlist Management - Appointments",
  description: "Manage and view all scheduled appointments",
}

export default function AppointmentsPage() {
  return (
    <div className="space-y-6 w-full md:w-[calc(100vw-17rem)]">
      <div>
        <h1 className="text-3xl font-bold text-primary mt-3">Appointments</h1>
        <p className="text-muted-foreground">
          Manage and view all scheduled appointments
        </p>
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Scheduled Appointments</CardTitle>
          <CardDescription>
            Search and filter appointments by ID, date range, and more. Use multiple filters to find specific appointments.
          </CardDescription>
        </CardHeader>
        <CardContent className="w-full overflow-hidden">
          <Suspense fallback={<div>Loading appointments...</div>}>
            <AppointmentsTable />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
} 