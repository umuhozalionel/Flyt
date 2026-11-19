"use client"

import { ArrowRight, MapPin, ReceiptText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatDate, formatMoney } from "@/lib/format"
import { useT } from "@/lib/i18n"
import { placeName } from "@/lib/places"
import type { TripAssignment } from "./types"

export function ReceiptScreen({ assignment, onDone, toast }: { assignment: TripAssignment; onDone: () => void; toast: (message: string) => void }) {
  const t = useT()
  const { trip, firm } = assignment
  return (
    <div className="px-5 pb-8 pt-6">
      <p className="text-center text-xs font-semibold tracking-widest text-muted-foreground">{t("rider.receipt.heading")}</p>
      <h1 className="mt-2 text-center text-2xl font-semibold">{firm?.name ?? "—"}</h1>
      <p className="mt-1 text-center text-sm text-muted-foreground">{t("rider.receipt.issuedBy")}</p>
      <div className="my-5 border-t border-dashed" />
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("rider.receipt.number")}</span>
          <span className="font-mono">{trip.receiptNo ?? t("rider.receipt.pending")}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("rider.receipt.tin")}</span>
          <span>{firm?.tin ?? "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("rider.receipt.licence")}</span>
          <span className="text-right">{firm?.ruraLicenceNo ?? "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("rider.receipt.date")}</span>
          <span>{formatDate(trip.createdAt)}</span>
        </div>
      </div>
      <div className="my-5 border-t border-dashed" />
      <div className="flex gap-3">
        <span className="grid size-8 place-items-center rounded-full bg-primary/10">
          <MapPin className="size-4 text-primary" />
        </span>
        <div>
          <p className="text-xs uppercase text-muted-foreground">{t("rider.receipt.route", { km: trip.distanceKm })}</p>
          <p className="mt-1 font-medium">
            {placeName(trip.pickup)} → {placeName(trip.dropoff)}
          </p>
        </div>
      </div>
      <div className="mt-5 flex justify-between border-t pt-4 text-lg font-bold">
        <span>{t("rider.receipt.total")}</span>
        <span>{formatMoney(trip.fare)}</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t("rider.receipt.taxNote")}</p>
      <div className="mt-6 grid grid-cols-2 gap-2">
        <Button variant="outline" className="min-h-12" onClick={() => toast(t("rider.receipt.downloadDemo"))}>
          <ReceiptText className="size-4" /> {t("rider.receipt.download")}
        </Button>
        <Button variant="outline" className="min-h-12" onClick={() => toast(t("rider.receipt.shareCopied"))}>
          <ArrowRight className="size-4" /> {t("rider.receipt.share")}
        </Button>
      </div>
      <Button className="mt-4 min-h-14 w-full" onClick={onDone}>
        {t("common.done")}
      </Button>
    </div>
  )
}
