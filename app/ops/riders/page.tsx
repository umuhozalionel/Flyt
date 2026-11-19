"use client"

import { Suspense } from "react"
import { RidersScreen } from "@/components/ops/riders-screen"

// Routing only. Detail views use ?id=, read on the client, so the page needs a Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <RidersScreen />
    </Suspense>
  )
}
