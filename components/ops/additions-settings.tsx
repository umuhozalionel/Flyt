"use client"

import { Gift, HeartHandshake, Plus, Trophy } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Field, Input, Select } from "@/components/ui/input"
import * as api from "@/lib/api"
import { useT, type TranslationKey } from "@/lib/i18n"
import type { BonusPeriod, BonusTarget, Firm } from "@/lib/types"
import { useLive } from "@/lib/use-live"
import { errorText, useOps } from "./ops-context"
import { Card } from "./ops-ui"

const periods: BonusPeriod[] = ["day", "week", "month"]

/** Platform settings for the additions: driver bonuses (tracking only, off by default) and reward points (tracking only). */
export function AdditionsSettings({ firms }: { firms: Firm[] }) {
  const t = useT()
  const { toast } = useOps()
  const settings = useLive(() => api.getSettings(), ["extras"])
  const targets = useLive(() => api.getBonusTargets(), ["extras"])
  const [editing, setEditing] = useState<Partial<BonusTarget>>()
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

  const on = !!settings.data?.bonusesEnabled
  return (
    <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
      <Card
        title={t("ops.bonus.title")}
        action={
          <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" role="switch" className="size-4 accent-[var(--primary)]" checked={on} disabled={busy || !settings.data} onChange={(event) => void run(() => api.setSetting("bonusesEnabled", event.target.checked), t(event.target.checked ? "ops.bonus.turnedOn" : "ops.bonus.turnedOff"))} />
            {t(on ? "ops.bonus.on" : "ops.bonus.off")}
          </label>
        }
      >
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Trophy className="mt-0.5 size-4 shrink-0 text-amber-500" /> {t("ops.bonus.note")}
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {(targets.data ?? []).map((target) => (
            <li key={target.id} className="flex items-center gap-3 rounded-xl border p-3 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{target.name}</span>
                <span className="text-xs text-muted-foreground">
                  {t("ops.bonus.rule", { target: target.target, period: t(`bonus.period.${target.period}` as TranslationKey) })} · {target.firmId ? firms.find((firm) => firm.id === target.firmId)?.name : t("ops.bonus.allFirms")}
                </span>
              </span>
              <Badge variant={target.active ? "default" : "outline"}>{t(target.active ? "ops.bonus.active" : "ops.bonus.inactive")}</Badge>
              <Button variant="outline" className="min-h-9" onClick={() => setEditing(target)}>
                {t("common.edit")}
              </Button>
            </li>
          ))}
        </ul>
        <Button variant="outline" className="mt-3 min-h-10" onClick={() => setEditing({ name: "", period: "week", target: 20, active: true })}>
          <Plus className="size-4" /> {t("ops.bonus.add")}
        </Button>
      </Card>
      <Card title={t("points.title")}>
        <p className="flex items-start gap-2 text-sm">
          <Gift className="mt-0.5 size-4 shrink-0 text-primary" /> {t("ops.points.rule", { rate: settings.data?.pointsPer1000Rwf ?? 1 })}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{t("ops.points.note")}</p>
      </Card>
      <Card title={t("ops.tips.byFirm")}>
        <div className="flex flex-col gap-2">
          {firms.map((firm) => (
            <div key={firm.id}>
              <p className="mb-1 text-xs font-semibold text-muted-foreground">{firm.name}</p>
              <TipsSwitch firm={firm} />
            </div>
          ))}
        </div>
      </Card>
      {editing && (
        <Dialog title={editing.id ? t("ops.bonus.edit") : t("ops.bonus.add")} onClose={() => setEditing(undefined)} closeLabel={t("common.close")}>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              void run(() => api.saveBonusTarget({ id: editing.id, name: editing.name ?? "", period: editing.period ?? "week", target: Number(editing.target), firmId: editing.firmId, active: !!editing.active }), t("ops.bonus.saved")).then((ok) => ok && setEditing(undefined))
            }}
          >
            <Field id="bonus-name" label={t("ops.bonus.name")}>
              <Input id="bonus-name" value={editing.name ?? ""} onChange={(event) => setEditing({ ...editing, name: event.target.value })} placeholder={t("ops.bonus.namePlaceholder")} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="bonus-target" label={t("ops.bonus.trips")}>
                <Input id="bonus-target" inputMode="numeric" value={String(editing.target ?? "")} onChange={(event) => setEditing({ ...editing, target: Number(event.target.value.replace(/\D/g, "")) })} />
              </Field>
              <Field id="bonus-period" label={t("ops.bonus.period")}>
                <Select id="bonus-period" value={editing.period} onChange={(event) => setEditing({ ...editing, period: event.target.value as BonusPeriod })}>
                  {periods.map((period) => (
                    <option key={period} value={period}>
                      {t(`bonus.period.${period}` as TranslationKey)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field id="bonus-firm" label={t("ops.bonus.firm")}>
              <Select id="bonus-firm" value={editing.firmId ?? ""} onChange={(event) => setEditing({ ...editing, firmId: event.target.value || undefined })}>
                <option value="">{t("ops.bonus.allFirms")}</option>
                {firms.map((firm) => (
                  <option key={firm.id} value={firm.id}>
                    {firm.name}
                  </option>
                ))}
              </Select>
            </Field>
            <label className="flex min-h-10 items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={!!editing.active} onChange={(event) => setEditing({ ...editing, active: event.target.checked })} />
              {t("ops.bonus.activeLabel")}
            </label>
            <Button type="submit" className="min-h-11" disabled={busy}>
              {t("common.save")}
            </Button>
          </form>
        </Dialog>
      )}
    </div>
  )
}

/** Per-firm switch for tips (off by default). Platform admins, or the firm's own admin. */
export function TipsSwitch({ firm }: { firm: Firm }) {
  const t = useT()
  const { toast } = useOps()
  const [busy, setBusy] = useState(false)
  return (
    <div className="flex items-start gap-3 rounded-xl border p-3">
      <HeartHandshake className="mt-0.5 size-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1 text-sm">
        <span className="block font-medium">{t("ops.tips.title")}</span>
        <span className="text-xs text-muted-foreground">{t("ops.tips.note")}</span>
      </span>
      <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          role="switch"
          className="size-4 accent-[var(--primary)]"
          checked={!!firm.tipsEnabled}
          disabled={busy}
          onChange={(event) => {
            setBusy(true)
            api
              .setFirmTips(firm.id, event.target.checked)
              .then((saved) => toast(t(saved.tipsEnabled ? "ops.tips.turnedOn" : "ops.tips.turnedOff", { firm: firm.name })))
              .catch((caught: unknown) => toast(errorText(caught, t("ops.actionFailed"))))
              .finally(() => setBusy(false))
          }}
        />
        {t(firm.tipsEnabled ? "ops.bonus.on" : "ops.bonus.off")}
      </label>
    </div>
  )
}
