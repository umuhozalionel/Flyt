"use client"

import { Check } from "lucide-react"
import { useT, type TranslationKey } from "@/lib/i18n"
import type { TripStatus } from "@/lib/types"

const steps: { key: TranslationKey; reachedAt: TripStatus[] }[] = [
  { key: "rider.steps.arriving", reachedAt: ["driver_arriving", "driver_arrived", "in_progress", "completed"] },
  { key: "rider.steps.arrived", reachedAt: ["driver_arrived", "in_progress", "completed"] },
  { key: "rider.steps.onTrip", reachedAt: ["in_progress", "completed"] },
]

/** Status steps on the live trip: arriving, arrived, on trip. */
export function TripSteps({ status }: { status: TripStatus }) {
  const t = useT()
  const currentIndex = steps.reduce((last, step, i) => (step.reachedAt.includes(status) ? i : last), -1)
  return (
    <ol className="mt-4 grid grid-cols-3 gap-2" aria-label={t("rider.steps.label")}>
      {steps.map((step, i) => {
        const done = i < currentIndex || status === "completed"
        const current = i === currentIndex && status !== "completed"
        return (
          <li key={step.key} aria-current={current ? "step" : undefined} className="flex flex-col items-center gap-1.5 text-center">
            <span className={`grid size-8 place-items-center rounded-full border-2 text-xs font-bold ${done ? "border-primary bg-primary text-primary-foreground" : current ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
              {done ? <Check className="size-4" /> : i + 1}
            </span>
            <span className={`text-xs ${current ? "font-semibold" : "text-muted-foreground"}`}>{t(step.key)}</span>
          </li>
        )
      })}
    </ol>
  )
}
