"use client"

import { demoAutoDispatch } from "./config"
import { useStored } from "./use-stored"

const KEY = "flyt-demo-auto-dispatch"
const isOnOff = (value: string): value is "on" | "off" => value === "on" || value === "off"

/**
 * Mock demo only: when on, a new rider booking is assigned and accepted automatically, as Part 1 did.
 * Turn it off on the Dispatch screen to assign from Ops by hand. Shared by every open tab.
 */
export function useAutoDispatch() {
  const [value, setValue] = useStored(KEY, "on", isOnOff)
  return [demoAutoDispatch && value === "on", (on: boolean) => setValue(on ? "on" : "off")] as const
}
