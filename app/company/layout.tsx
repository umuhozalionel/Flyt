"use client"

import { CompanyShell } from "@/components/company/company-shell"

// Routing only: every company portal screen loads its data on the client through lib/api.ts.
export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  return <CompanyShell>{children}</CompanyShell>
}
