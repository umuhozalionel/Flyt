"use client"

import { X } from "lucide-react"
import { useEffect, useId, useRef, type ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Modal dialog. Escape or the close button closes it; focus moves into it when it opens. */
export function Dialog({ title, description, onClose, children, closeLabel, wide = false }: { title: string; description?: string; onClose: () => void; children: ReactNode; closeLabel: string; wide?: boolean }) {
  const titleId = useId()
  const panel = useRef<HTMLElement>(null)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    panel.current?.querySelector<HTMLElement>("input, select, textarea, button:not([data-close])")?.focus()
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} className={cn("max-h-[92vh] w-full overflow-y-auto rounded-3xl bg-background p-5 shadow-2xl", wide ? "max-w-2xl" : "max-w-md")}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-xl font-semibold">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          <button data-close onClick={onClose} aria-label={closeLabel} className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary">
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </section>
    </div>
  )
}
