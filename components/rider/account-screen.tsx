"use client"

import { ArrowRight, FileCheck2, Globe2, Headphones, LogOut, Phone, ShieldCheck, WalletCards } from "lucide-react"
import { ThemeToggle } from "@/components/shared/theme"
import { supportEmail } from "@/lib/config"
import { formatPhone, initials } from "@/lib/format"
import { useT } from "@/lib/i18n"
import type { Company, Rider } from "@/lib/types"

export function AccountScreen({ rider, company, onEdit, onSignOut, toast }: { rider: Rider; company?: Company; onEdit: () => void; onSignOut: () => void; toast: (message: string) => void }) {
  const t = useT()
  const rows = [
    { icon: WalletCards, label: t("rider.account.payment"), action: () => toast(t("rider.account.paymentNote")) },
    { icon: Globe2, label: t("rider.account.language"), action: () => toast(t("rider.account.languageNote")) },
    { icon: Phone, label: t("rider.account.emergency"), action: () => toast(t("rider.account.emergencyNote")) },
    { icon: Headphones, label: t("rider.account.help"), action: () => toast(t("rider.account.helpNote", { email: supportEmail })) },
    { icon: FileCheck2, label: t("rider.account.terms"), action: () => toast(t("rider.account.terms")) },
    { icon: LogOut, label: t("rider.account.signOut"), action: onSignOut },
  ]
  return (
    <div className="px-5 pb-8 pt-6">
      <h1 className="text-2xl font-semibold">{t("rider.account.title")}</h1>
      <div className="mt-5 flex items-center gap-4 rounded-2xl border bg-card p-4">
        <span className="grid size-14 place-items-center rounded-full bg-primary/10 text-lg font-bold text-primary">{initials(rider.name)}</span>
        <span>
          <span className="block font-semibold">{rider.name}</span>
          <span className="text-sm text-muted-foreground">{formatPhone(rider.phone)}</span>
        </span>
        <button onClick={onEdit} className="ml-auto min-h-11 rounded-lg px-3 py-2 text-sm text-primary">
          {t("common.edit")}
        </button>
      </div>
      {company && (
        <div className="mt-4 rounded-2xl border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">{t("rider.account.companyAccount")}</p>
          <p className="mt-1 font-semibold">{company.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("rider.account.companyNote")}</p>
        </div>
      )}
      <div className="mt-5 flex flex-col divide-y rounded-2xl border bg-card">
        {rows.map(({ icon: Icon, label, action }) => (
          <button key={label} onClick={action} className="flex min-h-14 items-center gap-3 px-4 text-left">
            <Icon className="size-4 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium">{label}</span>
            <ArrowRight className="size-4 text-muted-foreground" />
          </button>
        ))}
        <div className="flex min-h-14 items-center gap-3 px-4">
          <span className="flex-1 text-sm font-medium">{t("theme.appearance")}</span>
          <ThemeToggle />
        </div>
      </div>
      <div className="mt-5 rounded-2xl border border-dashed p-4 text-xs leading-5 text-muted-foreground">
        <ShieldCheck className="mb-2 size-5 text-primary" />
        {t("rider.account.trustNote")}
      </div>
    </div>
  )
}
