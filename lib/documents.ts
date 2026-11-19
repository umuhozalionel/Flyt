import { daysBetween, kigaliDay } from "./time"
import type { ComplianceDocument, DocumentStatus, DocumentType } from "./types"

export const EXPIRY_WARNING_DAYS = 30

export const driverDocumentTypes: DocumentType[] = ["driving_licence", "national_id", "criminal_record", "professional_certificate"]
export const carDocumentTypes: DocumentType[] = ["registration", "inspection", "insurance"]

/** Status shown for a document, worked out from its review state and expiry date (Kigali time). */
export function documentStatus(doc: Pick<ComplianceDocument, "review" | "expiryDate">, today: string = kigaliDay()): DocumentStatus {
  if (doc.review === "missing") return "missing"
  if (doc.review === "pending_review") return "pending_review"
  if (!doc.expiryDate) return "valid"
  const daysLeft = daysBetween(today, doc.expiryDate)
  if (daysLeft < 0) return "expired"
  if (daysLeft <= EXPIRY_WARNING_DAYS) return "expiring_soon"
  return "valid"
}

/** True when a document blocks work: expired or missing. */
export function documentBlocks(doc: Pick<ComplianceDocument, "review" | "expiryDate">, today?: string) {
  const status = documentStatus(doc, today)
  return status === "expired" || status === "missing"
}
