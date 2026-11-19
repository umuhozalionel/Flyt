"use client"

import Link from "next/link"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, Select, Textarea } from "@/components/ui/input"
import * as api from "@/lib/api"
import { formatDate } from "@/lib/format"
import { useT, type TranslationKey } from "@/lib/i18n"
import type { Incident, IncidentStatus } from "@/lib/types"
import { errorText, useOps } from "./ops-context"
import { useOpsData, type OpsData } from "./ops-data"
import { Card, LoadError, Loading, PageHeader } from "./ops-ui"

const statuses: IncidentStatus[] = ["open", "investigating", "closed"]

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  const t = useT()
  return <Badge variant={status === "open" ? "destructive" : status === "closed" ? "secondary" : "outline"}>{t(`incident.status.${status}` as TranslationKey)}</Badge>
}

/** Incident log: status, linked trip and notes. Firm admins see incidents on their firm's trips and can add notes. */
export function IncidentsScreen() {
  const t = useT()
  const { data, error } = useOpsData()
  const [filter, setFilter] = useState<IncidentStatus | "">("")
  if (error && !data) return <LoadError error={error} />
  if (!data) return <Loading />
  const rows = data.incidents.filter((incident) => !filter || incident.status === filter).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return (
    <>
      <PageHeader title={t("ops.incidents.title")} detail={t("ops.incidents.detail", { open: data.incidents.filter((incident) => incident.status !== "closed").length })} />
      <div className="mb-4 max-w-xs">
        <Field id="incident-filter" label={t("ops.incidents.filter")}>
          <Select id="incident-filter" value={filter} onChange={(event) => setFilter(event.target.value as IncidentStatus | "")}>
            <option value="">{t("ops.incidents.all")}</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {t(`incident.status.${status}` as TranslationKey)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {rows.length ? rows.map((incident) => <IncidentCard key={incident.id} incident={incident} data={data} />) : <p className="text-sm text-muted-foreground">{t("ops.incidents.none")}</p>}
      </div>
    </>
  )
}

function IncidentCard({ incident, data }: { incident: Incident; data: OpsData }) {
  const t = useT()
  const { isPlatform, toast } = useOps()
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const trip = data.trips.find((item) => item.id === incident.tripId)
  const rider = data.riders.find((item) => item.id === trip?.riderId)

  async function save(update: { status?: IncidentStatus; note?: string }, done: string) {
    setBusy(true)
    try {
      await api.updateIncident(incident.id, update)
      if (update.note) setNote("")
      toast(done)
    } catch (caught) {
      toast(errorText(caught, t("ops.actionFailed")))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title={`${incident.id} · ${t(`incident.type.${incident.type}` as TranslationKey)}`} action={<IncidentStatusBadge status={incident.status} />}>
      <p className="text-sm">{incident.description}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        {formatDate(incident.createdAt)}
        {incident.reportedBy && ` · ${t("ops.incidents.reportedBy", { by: incident.reportedBy })}`}
        {trip && (
          <>
            {" · "}
            <Link href={`/ops/trips?id=${trip.id}`} className="font-medium text-foreground hover:underline">
              {t("ops.incidents.trip", { id: trip.id })}
            </Link>
            {rider && ` · ${rider.name}`}
          </>
        )}
      </p>
      <h4 className="mt-4 text-sm font-semibold">{t("ops.incidents.notes", { count: incident.notes.length })}</h4>
      {incident.notes.length ? (
        <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
          {incident.notes.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">{t("ops.incidents.noNotes")}</p>
      )}
      <form
        className="mt-3 flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (note.trim()) void save({ note }, t("ops.incidents.noteAdded"))
        }}
      >
        <Field id={`note-${incident.id}`} label={t("ops.incidents.addNote")}>
          <Textarea id={`note-${incident.id}`} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {isPlatform && (
            <>
              <label htmlFor={`status-${incident.id}`} className="text-sm text-muted-foreground">
                {t("ops.incidents.status")}
              </label>
              <Select id={`status-${incident.id}`} className="w-40" disabled={busy} value={incident.status} onChange={(event) => void save({ status: event.target.value as IncidentStatus }, t("ops.incidents.statusSaved", { status: t(`incident.status.${event.target.value}` as TranslationKey) }))}>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {t(`incident.status.${status}` as TranslationKey)}
                  </option>
                ))}
              </Select>
            </>
          )}
          <Button type="submit" className="min-h-10" disabled={busy || !note.trim()}>
            {t("ops.incidents.saveNote")}
          </Button>
        </div>
      </form>
    </Card>
  )
}
