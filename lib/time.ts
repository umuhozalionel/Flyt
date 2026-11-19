// All "today", week and invoice-period figures use Kigali time (Africa/Kigali, UTC+2, no daylight saving).
export const KIGALI_TZ = "Africa/Kigali"

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: KIGALI_TZ, year: "numeric", month: "2-digit", day: "2-digit" })

/** Kigali calendar date as "YYYY-MM-DD". */
export function kigaliDay(value: string | Date = new Date()) {
  return dayFormat.format(typeof value === "string" ? new Date(value) : value)
}

/** Kigali month as "YYYY-MM", used for invoice periods. */
export function kigaliMonth(value: string | Date = new Date()) {
  return kigaliDay(value).slice(0, 7)
}

/** The month before a "YYYY-MM" period. */
export function previousMonth(period: string) {
  const [year, month] = period.split("-").map(Number)
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`
}

/** Kigali hour of the day, 0 to 23. */
export function kigaliHour(value: Date = new Date()) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: KIGALI_TZ, hour: "2-digit", hourCycle: "h23" }).format(value))
}

/** Whole days from one Kigali date to another ("YYYY-MM-DD"). */
export function daysBetween(fromDay: string, toDay: string) {
  return Math.round((Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / 86_400_000)
}

export function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 86_400_000)
}

/** Part of the day for a greeting, from the Kigali hour: morning 05–11, afternoon 12–17, evening 18–04. */
export function partOfDay(hour: number): "morning" | "afternoon" | "evening" {
  if (hour >= 5 && hour < 12) return "morning"
  if (hour >= 12 && hour < 18) return "afternoon"
  return "evening"
}
