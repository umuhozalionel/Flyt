"use client"

import { Badge } from "@/components/ui/badge"
import { useT, type TranslationKey } from "@/lib/i18n"
import type { DocumentStatus, TripStatus } from "@/lib/types"

export function StatusBadge({ status }: { status: TripStatus | DocumentStatus }) {
  const t = useT()
  const variant = status === "completed" || status === "valid" ? "secondary" : status.startsWith("cancelled") || status === "expired" || status === "missing" ? "destructive" : "outline"
  return <Badge variant={variant}>{t(`status.${status}` as TranslationKey)}</Badge>
}

/** Badge for a compliance document, with the expiry date when there is one. */
export function DocumentBadge({ status }: { status: DocumentStatus }) {
  return <StatusBadge status={status} />
}
