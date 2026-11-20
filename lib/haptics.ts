"use client"

// Short vibrations where the phone supports them (Android browsers; iPhones ignore it). Never required for any step.
const patterns = { light: 12, success: [18, 60, 28], warning: [40, 50, 40], offer: [220, 90, 220, 90, 320] } as const

export type HapticKind = keyof typeof patterns

export function haptic(kind: HapticKind = "light") {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(patterns[kind] as number | number[])
  } catch {
    // Not allowed here (for example before the first tap): skip.
  }
}
