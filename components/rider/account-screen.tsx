"use client"

import { ArrowRight, FileCheck2, Globe2, Headphones, LogOut, MapPin, Phone, ShieldCheck, WalletCards } from "lucide-react"
import { ThemeToggle } from "@/components/shared/theme"
import { supportEmail } from "@/lib/config"
import { formatPhone, initials } from "@/lib/format"
import { languages, useT } from "@/lib/i18n"
import type { Company, Language, Rider } from "@/lib/types"

export function AccountScreen(props: {
  rider: Rider
  company?: Company
  onEdit: () => void
  onPlaces: () => void
  onContacts: () => void
  onLanguage: (language: Language) => void
  onSignOut: () => void
  toast: (message: string) => void
}) {
  const t = useT()
  const { rider, company, toast } = props
  const rows = [
    { icon: MapPin, label: t("rider.account.places"), detail: t("rider.account.placesCount", { count: rider.savedPlaces.length }), action: props.onPlaces },
    { icon: WalletCards, label: t("rider.account.payment"), detail: t("rider.account.paymentDetail"), action: () => toast(t("rider.account.paymentNote")) },
    { icon: Phone, label: t("rider.account.emergency"), detail: t("rider.account.contactsCount", { count: rider.emergencyContacts.length }), action: props.onContacts },
    { icon: Headphones, label: t("rider.account.help"), action: () => toast(t("rider.account.helpNote", { email: supportEmail })) },
    { icon: FileCheck2, label: t("rider.account.terms"), action: () => toast(t("rider.account.terms")) },
    { icon: LogOut, label: t("rider.account.signOut"), action: props.onSignOut },
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
        <button onClick={props.onEdit} className="ml-auto min-h-11 rounded-lg px-3 py-2 text-sm text-primary">
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
        {rows.map(({ icon: Icon, label, detail, action }) => (
          <button key={label} onClick={action} className="flex min-h-14 items-center gap-3 px-4 text-left">
            <Icon className="size-4 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium">
              {label}
              {detail && <span className="block text-xs font-normal text-muted-foreground">{detail}</span>}
            </span>
            <ArrowRight className="size-4 text-muted-foreground" />
          </button>
        ))}
        <label className="flex min-h-14 items-center gap-3 px-4">
          <Globe2 className="size-4 text-muted-foreground" />
          <span className="flex-1 text-sm font-medium">{t("rider.account.languageLabel")}</span>
          <select aria-label={t("rider.account.languageLabel")} value={rider.language} onChange={(event) => props.onLanguage(event.target.value as Language)} className="min-h-10 rounded-lg border bg-background px-2 text-sm">
            {languages.map((language) => (
              <option key={language.id} value={language.id}>
                {language.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex min-h-14 items-center gap-3 px-4">
          <span className="flex-1 text-sm font-medium">{t("theme.appearance")}</span>
          <ThemeToggle />
        </div>
      </div>
      {rider.language !== "en" && <p className="mt-2 text-xs text-muted-foreground">{t("rider.account.languageNote")}</p>}
      <div className="mt-5 rounded-2xl border border-dashed p-4 text-xs leading-5 text-muted-foreground">
        <ShieldCheck className="mb-2 size-5 text-primary" />
        {t("rider.account.trustNote")}
      </div>
    </div>
  )
}
