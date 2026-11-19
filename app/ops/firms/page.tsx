"use client"

import { Suspense } from "react"
import { FirmsScreen } from "@/components/ops/firms-screen"

// Detail views use ?id=, read on the client, so the page needs a Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <FirmsScreen />
    </Suspense>
  )
}
