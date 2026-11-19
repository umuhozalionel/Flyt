"use client"

import { Suspense } from "react"
import { InvoicesScreen } from "@/components/ops/invoices-screen"

// Routing only. Detail views use ?id=, read on the client, so the page needs a Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <InvoicesScreen />
    </Suspense>
  )
}
