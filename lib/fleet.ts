import { carDocumentTypes, driverDocumentTypes } from "./documents"
import type { ComplianceDocument, DocumentType } from "./types"

// Checks for the Ops add forms. The mock adapter and the Postgres functions apply the same rules.

/** Rwandan plate as "RAB 123 C". Accepts lower case and missing spaces. Returns undefined when invalid. */
export function normalizePlate(input: string) {
  const compact = input.toUpperCase().replace(/\s+/g, "")
  const match = /^(R[A-Z]{2})(\d{3})([A-Z])$/.exec(compact)
  return match ? `${match[1]} ${match[2]} ${match[3]}` : undefined
}

const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))

/** Compliance documents for a new driver or car. A type with no expiry date is recorded as missing. */
export function buildDocuments(ownerId: string, kind: "driver" | "car", expiries: Partial<Record<DocumentType, string>>): ComplianceDocument[] {
  const types = kind === "driver" ? driverDocumentTypes : carDocumentTypes
  return types.map((type) => {
    const expiry = expiries[type]?.trim()
    if (expiry && !isDay(expiry)) throw new Error("Document dates must be real dates")
    // The national ID has no expiry in this version; any date entered marks it as on file.
    if (type === "national_id") return { id: `${ownerId}-${type}`, type, review: expiry ? "on_file" : "missing" }
    return { id: `${ownerId}-${type}`, type, expiryDate: expiry || undefined, review: expiry ? "on_file" : "missing" }
  })
}

export const isWholeRwf = (value: number) => Number.isInteger(value) && value > 0
