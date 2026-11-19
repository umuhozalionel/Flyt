"use client"

import { Copy, MessageSquareText, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Field, Input } from "@/components/ui/input"
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table"
import { errorText } from "@/components/ops/ops-context"
import * as api from "@/lib/api"
import { companyMonth } from "@/lib/company"
import { formatPhone, normalizePhone } from "@/lib/format"
import { useT } from "@/lib/i18n"
import type { Rider } from "@/lib/types"
import { useCompany } from "./company-context"
import { useCompanyData } from "./company-data"
import { Card, LoadError, NoCompany, PageHeader } from "./company-ui"

/** Staff: add, remove and invite by phone. Invites go from the admin's own phone; Flyt sends no SMS in this version. */
export function CompanyStaff() {
  const t = useT()
  const { toast } = useCompany()
  const { data, error } = useCompanyData()
  const [dialog, setDialog] = useState<"add" | "invite">()
  const [removing, setRemoving] = useState<Rider>()
  const [busy, setBusy] = useState(false)
  if (error && !data) return <LoadError error={error} />
  if (!data) return <NoCompany />

  async function remove(rider: Rider) {
    setBusy(true)
    try {
      await api.removeStaff(rider.companyId ?? "", rider.id)
      toast(t("company.staff.removed", { name: rider.name }))
      setRemoving(undefined)
    } catch (caught) {
      toast(errorText(caught, t("ops.actionFailed")))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title={t("company.staff.title")}
        detail={t("company.staff.detail", { count: data.staff.length, total: data.company.staffCount })}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="min-h-10" onClick={() => setDialog("invite")}>
              <MessageSquareText className="size-4" /> {t("company.staff.invite")}
            </Button>
            <Button className="min-h-10" onClick={() => setDialog("add")}>
              <Plus className="size-4" /> {t("company.staff.add")}
            </Button>
          </div>
        }
      />
      <Card>
        {data.staff.length ? (
          <Table className="min-w-[520px]">
            <THead>
              <tr>
                <Th>{t("company.staff.name")}</Th>
                <Th>{t("company.staff.phone")}</Th>
                <Th className="text-right">{t("company.staff.monthTrips")}</Th>
                <Th>{t("company.staff.routes")}</Th>
                <Th className="text-right">{t("company.staff.action")}</Th>
              </tr>
            </THead>
            <TBody>
              {data.staff.map((rider) => {
                const month = companyMonth(data.trips.filter((trip) => trip.riderId === rider.id), data.company.id)
                const routes = data.routes.filter((route) => route.riderIds.includes(rider.id))
                return (
                  <Tr key={rider.id}>
                    <Td className="font-semibold">
                      {rider.name}
                      {!rider.consentAt && <span className="block text-xs font-normal text-muted-foreground">{t("company.staff.notSignedIn")}</span>}
                    </Td>
                    <Td>{formatPhone(rider.phone)}</Td>
                    <Td className="text-right tabular-nums">{month.trips}</Td>
                    <Td>{routes.map((route) => route.name).join(", ") || "—"}</Td>
                    <Td className="text-right">
                      <Button size="sm" variant="outline" className="min-h-9" onClick={() => setRemoving(rider)} aria-label={t("company.staff.removeLabel", { name: rider.name })}>
                        <Trash2 className="size-4" /> {t("company.staff.remove")}
                      </Button>
                    </Td>
                  </Tr>
                )
              })}
            </TBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">{t("company.staff.none")}</p>
        )}
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">{t("company.staff.joinCodeNote", { code: data.company.joinCode })}</p>
      {dialog === "add" && <AddStaffDialog companyId={data.company.id} onClose={() => setDialog(undefined)} />}
      {dialog === "invite" && <InviteDialog companyName={data.company.name} joinCode={data.company.joinCode} onClose={() => setDialog(undefined)} />}
      {removing && (
        <Dialog title={t("company.staff.removeTitle", { name: removing.name })} description={t("company.staff.removeDetail")} onClose={() => setRemoving(undefined)} closeLabel={t("common.close")}>
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="min-h-10" onClick={() => setRemoving(undefined)}>
              {t("ops.form.cancel")}
            </Button>
            <Button variant="destructive" className="min-h-10" disabled={busy} onClick={() => void remove(removing)}>
              {t("company.staff.remove")}
            </Button>
          </div>
        </Dialog>
      )}
    </>
  )
}

function AddStaffDialog({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const t = useT()
  const { toast } = useCompany()
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: "", phone: "" })
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const rider = await api.addStaff(companyId, form)
      toast(t("company.staff.added", { name: rider.name }))
      onClose()
    } catch (caught) {
      toast(errorText(caught, t("ops.actionFailed")))
      setBusy(false)
    }
  }
  return (
    <Dialog title={t("company.staff.add")} description={t("company.staff.addDetail")} onClose={onClose} closeLabel={t("common.close")}>
      <form className="flex flex-col gap-3" onSubmit={(event) => void submit(event)}>
        <Field id="staff-phone" label={t("company.staff.phone")}>
          <Input id="staff-phone" type="tel" required placeholder="0788 123 456" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
        </Field>
        <Field id="staff-name" label={t("company.staff.name")} hint={t("company.staff.nameHint")}>
          <Input id="staff-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
        </Field>
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="outline" className="min-h-10" onClick={onClose}>
            {t("ops.form.cancel")}
          </Button>
          <Button type="submit" className="min-h-10" disabled={busy}>
            {busy ? t("common.saving") : t("company.staff.save")}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function InviteDialog({ companyName, joinCode, onClose }: { companyName: string; joinCode: string; onClose: () => void }) {
  const t = useT()
  const { toast } = useCompany()
  const [phone, setPhone] = useState("")
  const normalized = normalizePhone(phone)
  const text = t("company.staff.inviteText", { company: companyName, code: joinCode })
  const smsHref = normalized ? `sms:${normalized.replace(/\s+/g, "")}?body=${encodeURIComponent(text)}` : undefined
  return (
    <Dialog title={t("company.staff.invite")} description={t("company.staff.inviteDetail")} onClose={onClose} closeLabel={t("common.close")}>
      <div className="flex flex-col gap-3">
        <Field id="invite-phone" label={t("company.staff.phone")}>
          <Input id="invite-phone" type="tel" placeholder="0788 123 456" value={phone} onChange={(event) => setPhone(event.target.value)} aria-invalid={!!phone && !normalized} />
        </Field>
        <p className="rounded-xl bg-secondary p-3 text-sm">{text}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            className="min-h-10"
            onClick={() =>
              void navigator.clipboard
                ?.writeText(text)
                .then(() => toast(t("company.staff.copied")))
                .catch(() => toast(t("ops.actionFailed")))
            }
          >
            <Copy className="size-4" /> {t("company.staff.copy")}
          </Button>
          {smsHref ? (
            <a href={smsHref} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">
              <MessageSquareText className="size-4" /> {t("company.staff.openSms")}
            </a>
          ) : (
            <Button className="min-h-10" disabled>
              <MessageSquareText className="size-4" /> {t("company.staff.openSms")}
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  )
}
