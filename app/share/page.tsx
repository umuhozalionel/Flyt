"use client"

import { SharedTripPage } from "@/components/shared/shared-trip"

// Routing only: the live trip-sharing page. The token is in the address after # so it is never sent to a server log.
export default function SharePage() {
  return <SharedTripPage />
}
