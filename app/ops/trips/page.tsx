"use client"

import { Suspense } from "react"
import { TripsScreen } from "@/components/ops/trips-screen"

// Detail views use ?id=, read on the client, so the page needs a Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <TripsScreen />
    </Suspense>
  )
}
