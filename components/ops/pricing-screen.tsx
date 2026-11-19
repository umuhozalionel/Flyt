"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Field, Input, Select } from "@/components/ui/input"
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table"
import * as api from "@/lib/api"
import { platformFeeChoices } from "@/lib/config"
import { formatMoney } from "@/lib/format"
import { useT } from "@/lib/i18n"
import { distanceBetween, placeName, places } from "@/lib/places"
import { activePlan, distanceFare, fareSplit, sharedSeatFare } from "@/lib/pricing"
import type { AirportZone, PlatformFeePercent, PricingConfig, PricingPlan } from "@/lib/types"
import { errorText, useOps } from "./ops-context"
import { useOpsData } from "./ops-data"
import { Card, LoadError, Loading, PageHeader, PlatformOnly } from "./ops-ui"

function useRun() {
  const t = useT()
  const { toast } = useOps()
  const [busy, setBusy] = useState(false)
  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true)
    try {
      await action()
      toast(done)
      return true
    } catch (caught) {
      toast(errorText(caught, t("ops.actionFailed")))
      return false
    } finally {
      setBusy(false)
    }
  }
  return { busy, run }
}

export function PricingScreen() {
  const t = useT()
  const { isPlatform } = useOps()
  const { data, error } = useOpsData()
  if (!isPlatform) return <PlatformOnly />
  if (error && !data) return <LoadError error={error} />
  if (!data) return <Loading />
  const pricing = data.pricing
  return (
    <>
      <PageHeader title={t("ops.pricing.title")} detail={t("ops.pricing.detail")} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {pricing.plans.map((plan) => (
          <PlanCard key={`${plan.name}-${plan.firstKm}-${plan.perKm}-${plan.sharedSeatPercent}`} plan={plan} />
        ))}
        <FarePreview pricing={pricing} />
        <FirmFees firms={data.firms} />
        <AirportZones key={JSON.stringify(pricing.airportZones) + activePlan(pricing).name} pricing={pricing} />
      </div>
    </>
  )
}

function PlanCard({ plan }: { plan: PricingPlan }) {
  const t = useT()
  const { busy, run } = useRun()
  const [values, setValues] = useState({ firstKm: String(plan.firstKm), perKm: String(plan.perKm), sharedSeatPercent: String(plan.sharedSeatPercent) })
  const [confirming, setConfirming] = useState(false)
  const set = (key: keyof typeof values) => (event: { target: { value: string } }) => setValues((current) => ({ ...current, [key]: event.target.value }))
  const changed = values.firstKm !== String(plan.firstKm) || values.perKm !== String(plan.perKm) || values.sharedSeatPercent !== String(plan.sharedSeatPercent)
  return (
    <Card
      title={t("ops.pricing.plan", { name: plan.name })}
      action={
        plan.isActive ? (
          <Badge>{t("ops.pricing.active")}</Badge>
        ) : (
          <Button size="sm" variant="outline" className="min-h-9" onClick={() => setConfirming(true)}>
            {t("ops.pricing.makeActive")}
          </Button>
        )
      }
    >
      <form
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault()
          void run(() => api.updatePlan(plan.name, { firstKm: Number(values.firstKm), perKm: Number(values.perKm), sharedSeatPercent: Number(values.sharedSeatPercent) }), t("ops.pricing.saved", { name: plan.name }))
        }}
      >
        <Field id={`${plan.name}-first`} label={t("ops.pricing.firstKm")}>
          <Input id={`${plan.name}-first`} type="number" min={0} step={1} required inputMode="numeric" value={values.firstKm} onChange={set("firstKm")} />
        </Field>
        <Field id={`${plan.name}-per`} label={t("ops.pricing.perKm")}>
          <Input id={`${plan.name}-per`} type="number" min={0} step={1} required inputMode="numeric" value={values.perKm} onChange={set("perKm")} />
        </Field>
        <Field id={`${plan.name}-seat`} label={t("ops.pricing.seatPercent")}>
          <Input id={`${plan.name}-seat`} type="number" min={1} max={100} step={1} required inputMode="numeric" value={values.sharedSeatPercent} onChange={set("sharedSeatPercent")} />
        </Field>
        <p className="text-xs text-muted-foreground sm:col-span-3">{t("ops.pricing.example", { fare: formatMoney(distanceFare(5, plan)), seat: formatMoney(sharedSeatFare(5, plan)) })}</p>
        <div className="flex justify-end sm:col-span-3">
          <Button type="submit" className="min-h-10" disabled={busy || !changed}>
            {busy ? t("common.saving") : t("ops.pricing.save")}
          </Button>
        </div>
      </form>
      {confirming && (
        <Dialog title={t("ops.pricing.confirmTitle", { name: plan.name })} description={t("ops.pricing.confirmDetail")} onClose={() => setConfirming(false)} closeLabel={t("common.close")}>
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="min-h-10" onClick={() => setConfirming(false)}>
              {t("ops.form.cancel")}
            </Button>
            <Button className="min-h-10" disabled={busy} onClick={() => void run(() => api.setActivePlan(plan.name), t("ops.pricing.activated", { name: plan.name })).then(() => setConfirming(false))}>
              {t("ops.pricing.makeActive")}
            </Button>
          </div>
        </Dialog>
      )}
    </Card>
  )
}

function FarePreview({ pricing }: { pricing: PricingConfig }) {
  const t = useT()
  const [km, setKm] = useState("5")
  const [fee, setFee] = useState("12")
  const distance = Number(km)
  const valid = Number.isFinite(distance) && distance > 0 && distance <= 200
  return (
    <Card title={t("ops.pricing.preview")}>
      <div className="grid grid-cols-2 gap-3">
        <Field id="preview-km" label={t("ops.pricing.previewKm")}>
          <Input id="preview-km" type="number" min={0.5} max={200} step={0.5} inputMode="decimal" value={km} onChange={(event) => setKm(event.target.value)} />
        </Field>
        <Field id="preview-fee" label={t("ops.pricing.previewFee")}>
          <Select id="preview-fee" value={fee} onChange={(event) => setFee(event.target.value)}>
            {platformFeeChoices.map((choice) => (
              <option key={choice} value={choice}>
                {choice}%
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {valid ? (
        <Table className="mt-3 min-w-0">
          <THead>
            <tr>
              <Th>{t("ops.pricing.previewPlan")}</Th>
              <Th className="text-right">{t("ops.pricing.previewPrivate")}</Th>
              <Th className="text-right">{t("ops.pricing.previewSeat")}</Th>
              <Th className="text-right">{t("ops.pricing.previewFlyt")}</Th>
              <Th className="text-right">{t("ops.pricing.previewFirm")}</Th>
            </tr>
          </THead>
          <TBody>
            {pricing.plans.map((plan) => {
              const fare = distanceFare(distance, plan)
              const split = fareSplit(fare, Number(fee))
              return (
                <Tr key={plan.name}>
                  <Td className="font-medium">
                    {plan.name}
                    {plan.isActive && <span className="ml-1 text-xs text-muted-foreground">({t("ops.pricing.active")})</span>}
                  </Td>
                  <Td className="text-right tabular-nums">{formatMoney(fare)}</Td>
                  <Td className="text-right tabular-nums">{formatMoney(sharedSeatFare(distance, plan))}</Td>
                  <Td className="text-right tabular-nums">{formatMoney(split.platformFee)}</Td>
                  <Td className="text-right tabular-nums">{formatMoney(split.firmKeeps)}</Td>
                </Tr>
              )
            })}
          </TBody>
        </Table>
      ) : (
        <p className="mt-3 text-sm text-destructive">{t("ops.pricing.previewInvalid")}</p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">{t("common.taxNote")}</p>
    </Card>
  )
}

function FirmFees({ firms }: { firms: { id: string; name: string; feePercent: PlatformFeePercent }[] }) {
  const t = useT()
  const { busy, run } = useRun()
  return (
    <Card title={t("ops.pricing.fees")}>
      <p className="mb-3 text-xs text-muted-foreground">{t("ops.pricing.feesDetail")}</p>
      <ul className="divide-y text-sm">
        {firms.map((firm) => (
          <li key={firm.id} className="flex items-center gap-3 py-2">
            <label htmlFor={`fee-${firm.id}`} className="min-w-0 flex-1 font-medium">
              {firm.name}
            </label>
            <Select id={`fee-${firm.id}`} className="w-24" disabled={busy} value={firm.feePercent} onChange={(event) => void run(() => api.setFirmFee(firm.id, Number(event.target.value) as PlatformFeePercent), t("ops.pricing.feeSaved", { name: firm.name, percent: event.target.value }))}>
              {platformFeeChoices.map((choice) => (
                <option key={choice} value={choice}>
                  {choice}%
                </option>
              ))}
            </Select>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function AirportZones({ pricing }: { pricing: PricingConfig }) {
  const t = useT()
  const { busy, run } = useRun()
  const plan = activePlan(pricing)
  const zonePlaces = places.filter((place) => place.id !== "airport")
  const [prices, setPrices] = useState<Record<string, string>>(() => Object.fromEntries(zonePlaces.map((place) => [place.id, String(pricing.airportZones.find((zone) => zone.placeId === place.id)?.price ?? "")])))
  return (
    <Card title={t("ops.pricing.zones")}>
      <p className="mb-3 text-xs text-muted-foreground">{t("ops.pricing.zonesDetail", { plan: plan.name })}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const zones: AirportZone[] = zonePlaces.map((place) => (prices[place.id]?.trim() ? { placeId: place.id, price: Number(prices[place.id]) } : { placeId: place.id }))
          void run(() => api.updateAirportZones(zones), t("ops.pricing.zonesSaved"))
        }}
      >
        <ul className="divide-y text-sm">
          {zonePlaces.map((place) => (
            <li key={place.id} className="flex items-center gap-3 py-2">
              <label htmlFor={`zone-${place.id}`} className="min-w-0 flex-1">
                <span className="font-medium">{placeName(place.id)}</span>
                <span className="block text-xs text-muted-foreground">{t("ops.pricing.formula", { fare: formatMoney(distanceFare(distanceBetween(place.id, "airport"), plan)), km: distanceBetween(place.id, "airport") })}</span>
              </label>
              <Input id={`zone-${place.id}`} type="number" min={1} step={1} inputMode="numeric" placeholder={t("ops.pricing.usesFormula")} className="w-32" value={prices[place.id] ?? ""} onChange={(event) => setPrices((current) => ({ ...current, [place.id]: event.target.value }))} />
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-end">
          <Button type="submit" className="min-h-10" disabled={busy}>
            {busy ? t("common.saving") : t("ops.pricing.saveZones")}
          </Button>
        </div>
      </form>
    </Card>
  )
}
