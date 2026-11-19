"use client"

import { demoAutoDispatch } from "./config"
import { useStored } from "./use-stored"

const KEY = "flyt-demo-auto-dispatch"
const isOnOff = (value: string): value is "on" | "off" => value === "on" || value === "off"

/**
 * Mock demo only, off by default (the pilot tests manual dispatch). When on, a new rider booking is
 * assigned and accepted automatically, and demo buttons can accept or move a trip for the driver.
 * Switched on the Dispatch screen and shared by every open tab. Always off in Supabase mode.
 */
export function useAutoDispatch() {
  const [value, setValue] = useStored(KEY, "off", isOnOff)
  return [demoAutoDispatch && value === "on", (on: boolean) => setValue(on ? "on" : "off")] as const
}
