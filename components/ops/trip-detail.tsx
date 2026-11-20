"use client"

import { ArrowLeft, Star } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { MapView } from "@/components/shared/map-view"
import { StatusBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Field, Input } from "@/components/ui/input"
import * as api from "@/lib/api"
import { formatDate, formatMoney, formatPhone } from "@/lib/format"
import { useT, type TranslationKey } from "@/lib/i18n"
import { feePercentOf, tripTimeline } from "@/lib/ops"
import { placeName } from "@/lib/places"
import type { Trip } from "@/lib/types"
import { errorText, useOps } from "./ops-context"
import type { OpsData } from "./ops-data"
import { Card, Facts, PageHeader } from "./ops-ui"

export function TripDetail({ tripId, data, onBack }: { tripId: string; data: OpsData; onBack: () => void }) {
  const t = useT()
  const { isPlatform } = useOps()
  const trip = data.trips.find((item) => item.id === tripId)
  const back = (
    <Button variant="outline" className="min-h-10" onClick={onBack}>
      <ArrowLeft className="size-4" /> {t("ops.trips.back")}
    </Button>
  )
  if (!trip) return <PageHeader title={t("ops.trips.notFound", { id: tripId })} action={back} />
  const rider = data.riders.find((item) => item.id === trip.riderId)
  const driver = data.drivers.find((item) => item.id === trip.driverId)
  const car = data.cars.find((item) => item.id === trip.carId)
  const firm = data.allFirms.find((item) => item.id === trip.firmId)
  const company = data.companies.find((item) => item.id === trip.companyId)
  const incidents = data.incidents.filter((item) => item.tripId === trip.id)
  const firmKeeps = trip.fare - trip.platformFee
  const hire = trip.type === "hourly" || trip.type === "daily"

  return (
    <>
      <PageHeader title={t("ops.trips.detailTitle", { id: trip.id })} detail={`${t(`tripType.${trip.type}` as TranslationKey)} · ${placeName(trip.pickup)} → ${placeName(trip.dropoff)}`} action={back} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-4">
          <Card title={t("ops.trips.summary")} action={<StatusBadge status={trip.status} />}>
            <Facts
              rows={[
                [t("ops.trips.rider"), rider ? `${rider.name} · ${formatPhone(rider.phone)}` : trip.riderId],
                [t("ops.trips.company"), company?.name ?? "—"],
                [t("ops.trips.firm"), firm ? `${firm.name} · ${firm.ruraLicenceNo}` : "—"],
                [t("ops.trips.driver"), driver ? <Link href={`/ops/drivers?id=${driver.id}`} className="text-primary hover:underline">{driver.name}</Link> : "—"],
                [t("ops.trips.car"), car ? <Link href={`/ops/cars?id=${car.id}`} className="text-primary hover:underline">{`${car.plate} · ${car.colour} ${car.make} ${car.model}`}</Link> : "—"],
                [t("ops.trips.distance"), hire ? t(trip.type === "hourly" ? "ops.trips.hours" : "ops.trips.days", { count: trip.hireQuantity ?? 1 }) : t("common.km", { km: trip.distanceKm })],
                [t("ops.trips.plan"), trip.planName],
                ...(trip.commuteRouteId ? ([[t("ops.trips.route"), trip.commuteRouteId]] as [string, string][]) : []),
                ...(trip.cancelReason ? ([[t("ops.trips.cancelReason"), `${trip.cancelReason}${trip.cancelledBy ? ` (${t(`ops.cancelledBy.${trip.cancelledBy}` as TranslationKey)})` : ""}`]] as [string, string][]) : []),
              ]}
            />
          </Card>
          <Card title={t("ops.trips.timeline")}>
            <ol className="flex flex-col gap-2 border-l pl-4">
              {tripTimeline(trip).map(({ step, at }) => (
                <li key={step} className="relative text-sm">
                  <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-primary" />
                  <span className="font-medium">{t(`ops.timeline.${step}` as TranslationKey)}</span>
                  <span className="ml-2 text-muted-foreground">{formatDate(at)}</span>
                </li>
              ))}
            </ol>
          </Card>
          <MapView pickup={trip.pickup} dropoff={trip.dropoff} car={!!driver} />
        </div>
        <div className="flex flex-col gap-4">
          <Card title={t("ops.trips.split")}>
            <dl className="text-sm">
              <div className="flex justify-between py-1.5">
                <dt>{t("ops.trips.fare")}</dt>
                <dd className="font-semibold tabular-nums">{formatMoney(trip.fare)}</dd>
              </div>
              <div className="flex justify-between py-1.5">
                <dt>{t("ops.trips.fee", { percent: feePercentOf(trip) })}</dt>
                <dd className="tabular-nums">− {formatMoney(trip.platformFee)}</dd>
              </div>
              <div className="flex justify-between border-t py-1.5 font-semibold">
                <dt>{t("ops.trips.firmKeeps")}</dt>
                <dd className="tabular-nums">{formatMoney(firmKeeps)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">{t("common.taxNote")}</p>
          </Card>
          {(trip.corrections?.length || (isPlatform && trip.status === "completed")) && <FareCorrections trip={trip} canCorrect={isPlatform && trip.status === "completed"} />}
          <Card title={t("ops.trips.payment")}>
            <Facts
              rows={[
                [t("ops.trips.method"), t(`payment.method.${trip.paymentMethod}` as TranslationKey)],
                [t("ops.trips.paymentStatus"), <Badge key="pay" variant={trip.paymentStatus === "failed" ? "destructive" : trip.paymentStatus === "paid" ? "secondary" : "outline"}>{t(`payment.status.${trip.paymentStatus}` as TranslationKey)}</Badge>],
                ...(trip.riderPaidAt && trip.paymentStatus === "pending" ? ([[t("ops.trips.riderSaysPaid"), formatDate(trip.riderPaidAt)]] as [string, string][]) : []),
                [t("ops.trips.receipt"), trip.receiptNo ?? "—"],
              ]}
            />
          </Card>
          <Card title={t("ops.trips.ratings")}>
            <Facts
              rows={[
                [
                  t("ops.trips.riderRated"),
                  trip.riderRating ? (
                    <span key="r" className="inline-flex items-center gap-1">
                      <Star className="size-3.5 fill-amber-400 text-amber-400" /> {trip.riderRating}
                      {trip.ratingTags?.length ? ` · ${trip.ratingTags.join(", ")}` : ""}
                    </span>
                  ) : (
                    "—"
                  ),
                ],
                ...(trip.ratingComment ? ([[t("ops.trips.comment"), `“${trip.ratingComment}”`]] as [string, string][]) : []),
                [t("ops.trips.driverRated"), trip.driverRating ? String(trip.driverRating) : "—"],
              ]}
            />
          </Card>
          <Card title={t("ops.trips.incidents", { count: incidents.length })}>
            {incidents.length ? (
              <ul className="flex flex-col gap-3 text-sm">
                {incidents.map((incident) => (
                  <li key={incident.id}>
                    <p className="font-medium">
                      {incident.id} · {t(`incident.type.${incident.type}` as TranslationKey)} · {t(`incident.status.${incident.status}` as TranslationKey)}
                    </p>
                    <p className="text-muted-foreground">{incident.description}</p>
                    {incident.notes.map((note) => (
                      <p key={note} className="mt-1 rounded-lg bg-secondary px-2 py-1 text-xs">
                        {note}
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t("ops.trips.noIncidents")}</p>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}

/** Fare corrections on a completed trip. Platform admins can correct the fare (0 voids the trip) with a reason. */
function FareCorrections({ trip, canCorrect }: { trip: Trip; canCorrect: boolean }) {
  const t = useT()
  const { admin, toast } = useOps()
  const [open, setOpen] = useState(false)
  const [fare, setFare] = useState(String(trip.fare))
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const corrections = trip.corrections ?? []

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      await api.correctTripFare({ adminId: admin?.id ?? "", tripId: trip.id, fare: Number(fare), reason })
      toast(t("ops.trips.corrected", { id: trip.id }))
      setOpen(false)
      setReason("")
    } catch (caught) {
      toast(errorText(caught, t("ops.actionFailed")))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card
      title={t("ops.trips.corrections")}
      action={
        canCorrect && (
          <Button size="sm" variant="outline" className="min-h-9" onClick={() => { setFare(String(trip.fare)); setOpen(true) }}>
            {t("ops.trips.correct")}
          </Button>
        )
      }
    >
      {corrections.length ? (
        <ol className="flex flex-col gap-2 text-sm">
          {corrections.map((item) => (
            <li key={item.at}>
              <span className="font-medium tabular-nums">
                {formatMoney(item.fromFare)} → {item.toFare ? formatMoney(item.toFare) : t("ops.trips.voided")}
              </span>
              <span className="ml-2 text-muted-foreground">{formatDate(item.at)}</span>
              <span className="block text-muted-foreground">{item.reason}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">{t("ops.trips.noCorrections")}</p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">{t("ops.trips.correctionsNote")}</p>
      {open && (
        <Dialog title={t("ops.trips.correctTitle", { id: trip.id })} description={t("ops.trips.correctDetail")} onClose={() => setOpen(false)} closeLabel={t("common.close")}>
          <form className="flex flex-col gap-3" onSubmit={(event) => void submit(event)}>
            <Field id="correct-fare" label={t("ops.trips.correctFare")}>
              <Input id="correct-fare" type="number" min={0} step={1} required inputMode="numeric" value={fare} onChange={(event) => setFare(event.target.value)} />
            </Field>
            <Field id="correct-reason" label={t("ops.trips.correctReason")}>
              <Input id="correct-reason" required maxLength={200} value={reason} onChange={(event) => setReason(event.target.value)} />
            </Field>
            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="outline" className="min-h-10" onClick={() => setOpen(false)}>
                {t("ops.form.cancel")}
              </Button>
              <Button type="submit" className="min-h-10" disabled={busy || !reason.trim() || fare.trim() === "" || Number(fare) === trip.fare}>
                {busy ? t("common.saving") : t("ops.trips.correctSave")}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </Card>
  )
}
