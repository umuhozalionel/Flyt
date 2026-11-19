import { KIGALI_TZ } from "./time"

export function formatMoney(amount: number) {
  return `Rwf ${Math.round(amount).toLocaleString("en-US")}`
}

/**
 * Normalise a Rwandan phone number to "+250 7XX XXX XXX".
 * Accepts "0788 123 456", "788123456", "250788123456" and "+250 788 123 456".
 * Returns undefined when it is not a valid Rwandan mobile number.
 */
export function normalizePhone(input: string) {
  let digits = input.replace(/\D/g, "")
  if (digits.startsWith("250")) digits = digits.slice(3)
  if (digits.startsWith("0")) digits = digits.slice(1)
  if (!/^7[2389]\d{7}$/.test(digits)) return undefined
  return `+250 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
}

export function formatPhone(phone: string) {
  return normalizePhone(phone) ?? phone
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase()
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: KIGALI_TZ, dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

export function formatDay(value: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: KIGALI_TZ, day: "numeric", month: "short" }).format(new Date(value))
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: KIGALI_TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(value))
}
