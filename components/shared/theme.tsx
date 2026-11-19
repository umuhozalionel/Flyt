"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react"
import { useStored } from "@/lib/use-stored"
import { useT } from "@/lib/i18n"

// Light by default; the person can pick dark or follow the system. Stored per browser.
export type ThemeChoice = "light" | "dark" | "system"
const STORAGE_KEY = "flyt-theme"

/** Runs before the page paints so there is no flash of the wrong theme. */
export const themeScript = `(function(){try{var c=localStorage.getItem("${STORAGE_KEY}")||"light";var d=c==="dark"||(c==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`

function apply(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  document.documentElement.classList.toggle("dark", dark)
}

const ThemeContext = createContext<{ theme: ThemeChoice; setTheme: (choice: ThemeChoice) => void }>({ theme: "light", setTheme: () => undefined })

const isTheme = (value: string): value is ThemeChoice => value === "light" || value === "dark" || value === "system"

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useStored<ThemeChoice>(STORAGE_KEY, "light", isTheme)
  useEffect(() => {
    apply(theme)
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => apply(theme)
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [theme])
  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}

const order: ThemeChoice[] = ["light", "dark", "system"]
const icons = { light: Sun, dark: Moon, system: Monitor }

/** One button that cycles light, dark and system. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const t = useT()
  const Icon = icons[theme]
  const next = order[(order.indexOf(theme) + 1) % order.length]
  return (
    <button
      onClick={() => setTheme(next)}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-medium hover:bg-secondary ${className}`}
      aria-label={t("theme.switch", { theme: t(`theme.${theme}`) })}
    >
      <Icon className="size-4" />
      <span>{t(`theme.${theme}`)}</span>
    </button>
  )
}
