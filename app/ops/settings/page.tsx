"use client"

import { Suspense } from "react"
import { SettingsScreen } from "@/components/ops/settings-screen"

// Routing only. Detail views use ?id=, read on the client, so the page needs a Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <SettingsScreen />
    </Suspense>
  )
}
