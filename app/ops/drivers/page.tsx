"use client"

import { Suspense } from "react"
import { DriversScreen } from "@/components/ops/drivers-screen"

// Detail views use ?id=, read on the client, so the page needs a Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <DriversScreen />
    </Suspense>
  )
}
