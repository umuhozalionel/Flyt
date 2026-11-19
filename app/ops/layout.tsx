"use client"

import { OpsShell } from "@/components/ops/ops-shell"

// Routing only: every Ops screen loads its data on the client through lib/api.ts.
export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return <OpsShell>{children}</OpsShell>
}
