import type { Metadata } from "next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WaitlistTable } from "@/components/waitlist-table";

export const metadata: Metadata = {
  title: "Medical Waitlist Management - Waitlist",
  description: "View and manage the patient waitlist with clinical priorities",
}

export default function WaitlistPage() {
  return (
    <div className="space-y-6 w-full md:w-[calc(100vw-17rem)]">
      <div>
        <h1 className="text-3xl font-bold text-primary mt-3">Patient Waitlist</h1>
        <p className="text-muted-foreground">
          View and manage the patient waitlist with clinical priorities
        </p>
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Waitlist Entries</CardTitle>
          <CardDescription>
            Patients awaiting appointments sorted by clinical urgency and severity
          </CardDescription>
        </CardHeader>
        <CardContent className="w-full overflow-hidden">
          <WaitlistTable />
        </CardContent>
      </Card>
    </div>
  );
} 