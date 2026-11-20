"use client"

import { MessageCircle } from "lucide-react"
import { useState } from "react"
import { ChatPanel } from "@/components/shared/chat-panel"
import { StatusBadge } from "@/components/shared/status-badge"
import { Field, Select } from "@/components/ui/input"
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table"
import { formatDate, formatMoney } from "@/lib/format"
import { useT, type TranslationKey } from "@/lib/i18n"
import { tripDay } from "@/lib/ops"
import { placeName } from "@/lib/places"
import { kigaliMonth } from "@/lib/time"
import { useCompany } from "./company-context"
import { useCompanyData } from "./company-data"
import { Card, LoadError, NoCompany, PageHeader } from "./company-ui"

/** Trips the company pays for: company-billed rides and shared commute seats. */
export function CompanyTrips() {
  const t = useT()
  const { data, error } = useCompanyData()
  const [month, setMonth] = useState(kigaliMonth())
  const [person, setPerson] = useState("")
  const [chatTrip, setChatTrip] = useState<string>()
  const { admin, toast } = useCompany()
  if (error && !data) return <LoadError error={error} />
  if (!data) return <NoCompany />
  const months = [...new Set([kigaliMonth(), ...data.trips.map((trip) => tripDay(trip).slice(0, 7))])].sort().reverse()
  const rows = data.trips.filter((trip) => (!month || tripDay(trip).startsWith(month)) && (!person || trip.riderId === person))
  const completed = rows.filter((trip) => trip.status === "completed")
  const name = (riderId: string) => data.people.find((rider) => rider.id === riderId)?.name ?? "—"
  return (
    <>
      <PageHeader title={t("company.trips.title")} detail={t("company.trips.detail", { count: completed.length, total: formatMoney(completed.reduce((sum, trip) => sum + trip.fare, 0)) })} />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field id="company-month" label={t("company.trips.month")}>
          <Select id="company-month" value={month} onChange={(event) => setMonth(event.target.value)}>
            <option value="">{t("company.trips.allMonths")}</option>
            {months.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="company-person" label={t("company.trips.person")}>
          <Select id="company-person" value={person} onChange={(event) => setPerson(event.target.value)}>
            <option value="">{t("company.trips.everyone")}</option>
            {data.people.map((rider) => (
              <option key={rider.id} value={rider.id}>
                {rider.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Card>
        {rows.length ? (
          <Table>
            <THead>
              <tr>
                <Th>{t("company.trips.when")}</Th>
                <Th>{t("company.trips.person")}</Th>
                <Th>{t("company.trips.route")}</Th>
                <Th>{t("company.trips.type")}</Th>
                <Th className="text-right">{t("company.trips.fare")}</Th>
                <Th>{t("company.trips.status")}</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((trip) => (
                <Tr key={trip.id}>
                  <Td>
                    {formatDate(trip.scheduledFor ?? trip.createdAt)}
                    <span className="block font-mono text-xs text-muted-foreground">{trip.id}</span>
                  </Td>
                  <Td>{name(trip.riderId)}</Td>
                  <Td>
                    {placeName(trip.pickup)} → {placeName(trip.dropoff)}
                  </Td>
                  <Td>{t(`tripType.${trip.type}` as TranslationKey)}</Td>
                  <Td className="text-right font-semibold tabular-nums">{formatMoney(trip.fare)}</Td>
                  <Td>
                    <StatusBadge status={trip.status} />
                    {admin && trip.paymentMethod === "company_account" && trip.driverId && ["assigned", "driver_arriving", "driver_arrived", "in_progress"].includes(trip.status) && (
                      <button onClick={() => setChatTrip(trip.id)} className="mt-1 flex min-h-9 items-center gap-1 text-xs font-semibold text-primary">
                        <MessageCircle className="size-3.5" /> {t("chat.openDriver")}
                      </button>
                    )}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">{t("company.trips.none")}</p>
        )}
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">{t("company.privacyNote")}</p>
      {chatTrip && admin && <ChatPanel tripId={chatTrip} channel="company_driver" me={{ sender: "company", senderId: admin.id }} open otherName={t("chat.driverName")} onClose={() => setChatTrip(undefined)} toast={toast} />}
    </>
  )
}
