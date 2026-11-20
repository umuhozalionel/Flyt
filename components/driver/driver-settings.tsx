"use client"

import { HeartHandshake, SlidersHorizontal } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import * as api from "@/lib/api"
import { HEADING_HOME_MAX_HOURS, headingHome, preferencesOf, tripTypes } from "@/lib/additions"
import { formatTime } from "@/lib/format"
import { useT, type TranslationKey } from "@/lib/i18n"
import { places } from "@/lib/places"
import type { Driver, Firm, PlaceId, TripType } from "@/lib/types"
import { useLive } from "@/lib/use-live"

/** Ride types the driver accepts and a heading-home area. Dispatch suggestions respect both. */
export function DriverPreferencesCard({ driver, toast }: { driver: Driver; toast: (message: string) => void }) {
  const t = useT()
  const prefs = useLive(() => api.getDriverPreferences(), ["extras"])
  const mine = preferencesOf(driver.id, prefs.data ?? [])
  const [types, setTypes] = useState<TripType[] | undefined>()
  const [zone, setZone] = useState<PlaceId | "">("")
  const [hours, setHours] = useState(4)
  const [busy, setBusy] = useState(false)
  const chosen = types ?? mine.rideTypes
  const home = headingHome(mine)

  async function save(update: { rideTypes?: TripType[]; zone?: PlaceId | ""; hours?: number }, done: string) {
    setBusy(true)
    try {
      const nextZone = update.zone ?? (home ? mine.headingHomeZone : undefined)
      const until = update.zone ? new Date(Date.now() + (update.hours ?? hours) * 3_600_000).toISOString() : home && update.zone !== "" ? mine.headingHomeUntil : undefined
      await api.setDriverPreferences(driver.id, { rideTypes: update.rideTypes ?? chosen, headingHomeZone: nextZone || undefined, headingHomeUntil: nextZone ? until : undefined })
      setTypes(undefined)
      toast(done)
    } catch (error) {
      toast(error instanceof Error ? error.message : t("driver.failed"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-5 rounded-2xl border bg-card p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <SlidersHorizontal className="size-4 text-primary" /> {t("prefs.title")}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">{t("prefs.note")}</p>
      <fieldset className="mt-3">
        <legend className="text-sm font-medium">{t("prefs.rideTypes")}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {tripTypes.map((type) => {
            const on = chosen.includes(type)
            return (
              <button key={type} aria-pressed={on} onClick={() => setTypes(on ? chosen.filter((item) => item !== type) : [...chosen, type])} className={`min-h-10 rounded-full border px-3 text-sm ${on ? "border-primary bg-primary/10 font-semibold" : ""}`}>
                {t(`tripType.${type}` as TranslationKey)}
              </button>
            )
          })}
        </div>
        {types && (
          <Button className="mt-3 min-h-11 w-full" disabled={busy || !types.length} onClick={() => void save({ rideTypes: types }, t("prefs.saved"))}>
            {types.length ? t("common.save") : t("prefs.pickOne")}
          </Button>
        )}
      </fieldset>
      <div className="mt-4 border-t pt-4">
        <p className="text-sm font-medium">{t("prefs.headingHome")}</p>
        {home ? (
          <div className="mt-2 flex items-center gap-2">
            <p className="flex-1 text-sm text-muted-foreground">{t("prefs.headingHomeOn", { zone: places.find((place) => place.id === mine.headingHomeZone)?.name ?? "", time: formatTime(mine.headingHomeUntil!) })}</p>
            <Button variant="outline" className="min-h-10" disabled={busy} onClick={() => void save({ zone: "" }, t("prefs.headingHomeOff"))}>
              {t("prefs.stop")}
            </Button>
          </div>
        ) : (
          <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
            <select aria-label={t("prefs.homeArea")} value={zone} onChange={(event) => setZone(event.target.value as PlaceId | "")} className="min-h-11 rounded-xl border bg-background px-2 text-sm">
              <option value="">{t("prefs.homeArea")}</option>
              {places.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name}
                </option>
              ))}
            </select>
            <select aria-label={t("prefs.forHours")} value={hours} onChange={(event) => setHours(Number(event.target.value))} className="min-h-11 rounded-xl border bg-background px-2 text-sm">
              {[1, 2, 4, 8, HEADING_HOME_MAX_HOURS].map((value) => (
                <option key={value} value={value}>
                  {t("prefs.hours", { hours: value })}
                </option>
              ))}
            </select>
            <Button className="col-span-2 min-h-11" disabled={busy || !zone} onClick={() => void save({ zone, hours }, t("prefs.headingHomeSet"))}>
              {t("prefs.start")}
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}

/** Tips: the driver opts in with their own MoMo number. Riders see it only on the tip screen, for 24 hours after a trip. */
export function TipSettingsCard({ driver, firm, toast }: { driver: Driver; firm?: Firm; toast: (message: string) => void }) {
  const t = useT()
  const [number, setNumber] = useState(driver.tipMomoNumber ?? "")
  const [busy, setBusy] = useState(false)
  const tips = useLive(() => api.getTips(), ["extras"])
  const mine = (tips.data ?? []).filter((tip) => tip.driverId === driver.id)

  async function save(optIn: boolean) {
    setBusy(true)
    try {
      await api.setTipSettings(driver.id, { optIn, momoNumber: number || undefined })
      toast(t(optIn ? "tips.optedIn" : "tips.optedOut"))
    } catch (error) {
      toast(error instanceof Error ? error.message : t("driver.failed"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-5 rounded-2xl border bg-card p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <HeartHandshake className="size-4 text-primary" /> {t("tips.title")}
      </h2>
      {!firm?.tipsEnabled ? (
        <p className="mt-1 text-sm text-muted-foreground">{t("tips.firmOff")}</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted-foreground">{t("tips.driverNote")}</p>
          <label htmlFor="tip-number" className="mt-3 block text-sm font-medium">
            {t("tips.number")}
          </label>
          <input id="tip-number" inputMode="tel" value={number} onChange={(event) => setNumber(event.target.value)} placeholder="078 000 0000" className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3" />
          <div className="mt-3 flex gap-2">
            {driver.tipsOptIn ? (
              <>
                <Button className="min-h-11 flex-1" disabled={busy} onClick={() => void save(true)}>
                  {t("common.save")}
                </Button>
                <Button variant="outline" className="min-h-11 flex-1" disabled={busy} onClick={() => void save(false)}>
                  {t("tips.optOut")}
                </Button>
              </>
            ) : (
              <Button className="min-h-11 flex-1" disabled={busy || !number.trim()} onClick={() => void save(true)}>
                {t("tips.optIn")}
              </Button>
            )}
          </div>
          {mine.length > 0 && <p className="mt-3 text-sm">{t("tips.received", { count: mine.length })}</p>}
        </>
      )}
    </section>
  )
}
