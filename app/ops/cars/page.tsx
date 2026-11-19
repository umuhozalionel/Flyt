"use client"

import { Suspense } from "react"
import { CarsScreen } from "@/components/ops/cars-screen"

// Detail views use ?id=, read on the client, so the page needs a Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <CarsScreen />
    </Suspense>
  )
}
