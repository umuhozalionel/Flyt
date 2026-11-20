"use client"

import { MotionConfig } from "motion/react"
import { useEffect, type ReactNode } from "react"
import { I18nProvider } from "@/lib/i18n"
import { registerServiceWorker } from "@/lib/push"
import { InstallHint } from "./install-hint"
import { ThemeProvider } from "./theme"

export function Providers({ children }: { children: ReactNode }) {
  // One service worker for the whole app: offline page, cached app files, and notifications.
  // Only in production builds, so development always loads fresh files.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") void registerServiceWorker()
  }, [])
  return (
    <I18nProvider>
      <ThemeProvider>
        {/* "user": movement follows the device's "reduce motion" setting. */}
        <MotionConfig reducedMotion="user">
          {children}
          <InstallHint />
        </MotionConfig>
      </ThemeProvider>
    </I18nProvider>
  )
}
