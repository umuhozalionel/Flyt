"use client"

import { Download, Navigation2, X } from "lucide-react"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { useT } from "@/lib/i18n"

const DISMISSED_KEY = "flyt-install-dismissed"
const SHOW_AFTER_MS = 25_000

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function dismissedBefore() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1"
  } catch {
    return false
  }
}

/**
 * "Add Flyt to your home screen": shown once, after a short while in the rider or driver app, when the browser can
 * install Flyt (Android and desktop Chrome) or on an iPhone (where it is done from the Share menu). Never in Ops.
 */
export function InstallHint() {
  const t = useT()
  const path = usePathname()
  const [prompt, setPrompt] = useState<InstallPromptEvent>()
  const [ios, setIos] = useState(false)
  const [visible, setVisible] = useState(false)
  const inApp = path === "/rider" || path === "/driver"

  useEffect(() => {
    if (!inApp || dismissedBefore() || window.matchMedia("(display-mode: standalone)").matches) return
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setPrompt(event as InstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", onPrompt)
    const iPhone = /iphone|ipad|ipod/i.test(navigator.userAgent) && !("standalone" in navigator && (navigator as { standalone?: boolean }).standalone)
    const timer = window.setTimeout(() => {
      setIos(iPhone)
      setVisible(true)
    }, SHOW_AFTER_MS)
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.clearTimeout(timer)
    }
  }, [inApp])

  function dismiss() {
    setVisible(false)
    try {
      localStorage.setItem(DISMISSED_KEY, "1")
    } catch {
      // Private window: it may show again next time.
    }
  }

  if (!inApp || !visible || (!prompt && !ios)) return null
  return (
    <aside aria-label={t("install.title")} className="fixed left-1/2 top-[4.5rem] z-30 flex w-[calc(100%-24px)] max-w-[406px] -translate-x-1/2 items-center gap-3 rounded-2xl border bg-background p-3 shadow-xl animate-in fade-in slide-in-from-top-2 motion-reduce:animate-none">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
        <Navigation2 className="size-5" strokeWidth={2.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{t("install.title")}</span>
        <span className="block text-xs text-muted-foreground">{ios ? t("install.iosDetail") : t("install.detail")}</span>
      </span>
      {prompt && !ios && (
        <button
          className="flex min-h-10 items-center gap-1 rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground"
          onClick={() => {
            void prompt.prompt()
            void prompt.userChoice.finally(dismiss)
          }}
        >
          <Download className="size-4" /> {t("install.button")}
        </button>
      )}
      <button onClick={dismiss} aria-label={t("install.dismiss")} className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-secondary">
        <X className="size-4" />
      </button>
    </aside>
  )
}
