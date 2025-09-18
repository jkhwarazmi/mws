import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { LayoutContent } from "./layout-content";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Medical Waitlist Management",
  description: "Medical application for managing appointments and waitlists",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          <LayoutContent>{children}</LayoutContent>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
