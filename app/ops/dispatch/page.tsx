"use client"

import { Suspense } from "react"
import { DispatchScreen } from "@/components/ops/dispatch-screen"

// Detail views use ?id=, read on the client, so the page needs a Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <DispatchScreen />
    </Suspense>
  )
}
