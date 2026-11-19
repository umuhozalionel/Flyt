"use client"

import type { ReactNode } from "react"
import { I18nProvider } from "@/lib/i18n"
import { ThemeProvider } from "./theme"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </I18nProvider>
  )
}
