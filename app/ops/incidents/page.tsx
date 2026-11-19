"use client"

import { Suspense } from "react"
import { IncidentsScreen } from "@/components/ops/incidents-screen"

// Routing only. Detail views use ?id=, read on the client, so the page needs a Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <IncidentsScreen />
    </Suspense>
  )
}
