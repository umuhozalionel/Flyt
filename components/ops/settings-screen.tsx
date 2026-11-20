"use client"

import { Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Field, Input, Select } from "@/components/ui/input"
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table"
import * as api from "@/lib/api"
import { formatPhone } from "@/lib/format"
import { useT, type TranslationKey } from "@/lib/i18n"
import type { AdminRole, AdminUser } from "@/lib/types"
import { useLive } from "@/lib/use-live"
import { errorText, useOps } from "./ops-context"
import { AdditionsSettings } from "./additions-settings"
import { useOpsData } from "./ops-data"
import { Card, LoadError, Loading, PageHeader, PlatformOnly } from "./ops-ui"

const roles: AdminRole[] = ["platform_admin", "firm_admin", "company_admin"]

/** Team members and roles. Firm admins see one firm; company admins use the company portal. */
export function SettingsScreen() {
  const t = useT()
  const { isPlatform, admin: me, toast } = useOps()
  const { data, error } = useOpsData()
  const team = useLive(api.getAdmins, ["admins"])
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<AdminUser>()
  const [busy, setBusy] = useState(false)
  if (!isPlatform) return <PlatformOnly />
  if ((error && !data) || team.error) return <LoadError error={error ?? team.error} />
  if (!data || !team.data) return <Loading />
  const where = (row: AdminUser) => (row.firmId ? data.allFirms.find((firm) => firm.id === row.firmId)?.name : row.companyId ? data.companies.find((company) => company.id === row.companyId)?.name : t("ops.settings.allOfFlyt"))

  async function remove(row: AdminUser) {
    setBusy(true)
    try {
      await api.removeAdmin(row.id, me?.id ?? "")
      toast(t("ops.settings.removed", { name: row.name }))
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
        title={t("ops.settings.title")}
        detail={t("ops.settings.detail")}
        action={
          <Button className="min-h-10" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> {t("ops.settings.add")}
          </Button>
        }
      />
      <Card title={t("ops.settings.team", { count: team.data.length })}>
        <Table className="min-w-[560px]">
          <THead>
            <tr>
              <Th>{t("ops.settings.name")}</Th>
              <Th>{t("ops.settings.role")}</Th>
              <Th>{t("ops.settings.scope")}</Th>
              <Th className="text-right">{t("ops.settings.action")}</Th>
            </tr>
          </THead>
          <TBody>
            {team.data.map((row) => (
              <Tr key={row.id}>
                <Td>
                  <span className="font-semibold">{row.name}</span>
                  {row.id === me?.id && <span className="ml-2 text-xs text-muted-foreground">{t("ops.settings.you")}</span>}
                  <span className="block text-xs text-muted-foreground">{formatPhone(row.phone)}</span>
                </Td>
                <Td>
                  <Badge variant={row.role === "platform_admin" ? "default" : "outline"}>{t(`ops.settings.roles.${row.role}` as TranslationKey)}</Badge>
                </Td>
                <Td>{where(row)}</Td>
                <Td className="text-right">
                  {row.id !== me?.id && (
                    <Button size="sm" variant="outline" className="min-h-9" onClick={() => setRemoving(row)} aria-label={t("ops.settings.removeLabel", { name: row.name })}>
                      <Trash2 className="size-4" /> {t("ops.settings.remove")}
                    </Button>
                  )}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
        <p className="mt-3 text-xs text-muted-foreground">{t("ops.settings.rolesNote")}</p>
      </Card>
      <AdditionsSettings firms={data.allFirms} />
      {adding && <AddMemberDialog firms={data.allFirms} companies={data.companies} onClose={() => setAdding(false)} />}
      {removing && (
        <Dialog title={t("ops.settings.removeTitle", { name: removing.name })} description={t("ops.settings.removeDetail")} onClose={() => setRemoving(undefined)} closeLabel={t("common.close")}>
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="min-h-10" onClick={() => setRemoving(undefined)}>
              {t("ops.form.cancel")}
            </Button>
            <Button variant="destructive" className="min-h-10" disabled={busy} onClick={() => void remove(removing)}>
              {t("ops.settings.remove")}
            </Button>
          </div>
        </Dialog>
      )}
    </>
  )
}

function AddMemberDialog({ firms, companies, onClose }: { firms: { id: string; name: string }[]; companies: { id: string; name: string }[]; onClose: () => void }) {
  const t = useT()
  const { toast } = useOps()
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: "", phone: "", role: "firm_admin" as AdminRole, firmId: firms[0]?.id ?? "", companyId: companies[0]?.id ?? "" })
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value }))

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const admin = await api.addAdmin({ name: form.name, phone: form.phone, role: form.role, firmId: form.firmId, companyId: form.companyId })
      toast(t("ops.settings.added", { name: admin.name }))
      onClose()
    } catch (caught) {
      toast(errorText(caught, t("ops.actionFailed")))
      setBusy(false)
    }
  }

  return (
    <Dialog title={t("ops.settings.add")} description={t("ops.settings.addDetail")} onClose={onClose} closeLabel={t("common.close")}>
      <form className="flex flex-col gap-3" onSubmit={(event) => void submit(event)}>
        <Field id="member-name" label={t("ops.settings.name")}>
          <Input id="member-name" required value={form.name} onChange={set("name")} />
        </Field>
        <Field id="member-phone" label={t("ops.settings.phone")}>
          <Input id="member-phone" type="tel" required placeholder="0788 123 456" value={form.phone} onChange={set("phone")} />
        </Field>
        <Field id="member-role" label={t("ops.settings.role")}>
          <Select id="member-role" value={form.role} onChange={set("role")}>
            {roles.map((role) => (
              <option key={role} value={role}>
                {t(`ops.settings.roles.${role}` as TranslationKey)}
              </option>
            ))}
          </Select>
        </Field>
        {form.role === "firm_admin" && (
          <Field id="member-firm" label={t("ops.settings.firm")}>
            <Select id="member-firm" value={form.firmId} onChange={set("firmId")}>
              {firms.map((firm) => (
                <option key={firm.id} value={firm.id}>
                  {firm.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {form.role === "company_admin" && (
          <Field id="member-company" label={t("ops.settings.company")}>
            <Select id="member-company" value={form.companyId} onChange={set("companyId")}>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="outline" className="min-h-10" onClick={onClose}>
            {t("ops.form.cancel")}
          </Button>
          <Button type="submit" className="min-h-10" disabled={busy}>
            {busy ? t("common.saving") : t("ops.settings.save")}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
