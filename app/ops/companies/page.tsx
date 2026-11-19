"use client"

import { Suspense } from "react"
import { CompaniesScreen } from "@/components/ops/companies-screen"

// Routing only. Detail views use ?id=, read on the client, so the page needs a Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <CompaniesScreen />
    </Suspense>
  )
}
