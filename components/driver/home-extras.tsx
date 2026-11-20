"use client"

import { Flame, Home, Trophy } from "lucide-react"
import * as api from "@/lib/api"
import { headingHome, preferencesOf } from "@/lib/additions"
import { formatTime } from "@/lib/format"
import { useT, type TranslationKey } from "@/lib/i18n"
import { placeName } from "@/lib/places"
import type { Driver } from "@/lib/types"
import { useLive } from "@/lib/use-live"

/** Driver home additions: busy areas (waiting requests per zone), heading home, and bonus progress (tracking only). */
export function DriverHomeExtras({ driver }: { driver: Driver }) {
  const t = useT()
  const busy = useLive(() => api.getBusyAreas(), ["trips"])
  const prefs = useLive(() => api.getDriverPreferences(), ["extras"])
  const bonuses = useLive(() => api.getBonusProgress(driver.id), ["extras", "trips"], [driver.id])
  const mine = preferencesOf(driver.id, prefs.data ?? [])
  const areas = (busy.data ?? []).slice(0, 4)
  const top = areas[0]?.waiting ?? 0

  return (
    <>
      {headingHome(mine) && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-primary/10 p-3 text-sm">
          <Home className="size-4 shrink-0 text-primary" /> {t("prefs.headingHomeOn", { zone: placeName(mine.headingHomeZone!), time: formatTime(mine.headingHomeUntil!) })}
        </p>
      )}
      <section className="mt-5 rounded-2xl border bg-card p-4" aria-label={t("busy.title")}>
        <h2 className="flex items-center gap-2 font-semibold">
          <Flame className="size-4 text-orange-500" /> {t("busy.title")}
        </h2>
        {areas.length ? (
          <ul className="mt-3 flex flex-col gap-2">
            {areas.map((area) => (
              <li key={area.zone} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 truncate font-medium">{placeName(area.zone)}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                  <span className="block h-full rounded-full bg-orange-500" style={{ width: `${Math.max(12, (area.waiting / top) * 100)}%` }} />
                </span>
                <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">{t("busy.waiting", { count: area.waiting })}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{busy.loading ? t("common.loading") : t("busy.none")}</p>
        )}
      </section>
      {(bonuses.data ?? []).length > 0 && (
        <section className="mt-4 rounded-2xl border bg-card p-4" aria-label={t("bonus.title")}>
          <h2 className="flex items-center gap-2 font-semibold">
            <Trophy className="size-4 text-amber-500" /> {t("bonus.title")}
          </h2>
          <ul className="mt-3 flex flex-col gap-3">
            {bonuses.data!.map((row) => (
              <li key={row.targetId}>
                <p className="flex justify-between text-sm">
                  <span className="font-medium">{row.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {Math.min(row.done, row.target)} / {row.target}
                  </span>
                </p>
                <span className="mt-1 block h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuemin={0} aria-valuemax={row.target} aria-valuenow={row.done} aria-label={row.name}>
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (row.done / row.target) * 100)}%` }} />
                </span>
                <p className="mt-1 text-xs text-muted-foreground">{t(`bonus.period.${row.period}` as TranslationKey)}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">{t("bonus.note")}</p>
        </section>
      )}
    </>
  )
}
