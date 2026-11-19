"use client"

import { HelpCircle, LogOut } from "lucide-react"
import { ThemeToggle } from "@/components/shared/theme"
import { Select } from "@/components/ui/input"
import { supportEmail } from "@/lib/config"
import { formatPhone, initials } from "@/lib/format"
import { languages, useLanguage, useT } from "@/lib/i18n"
import type { Car, Driver, Firm, Language } from "@/lib/types"

export function DriverProfileScreen({ driver, car, firm, onSignOut }: { driver: Driver; car?: Car; firm?: Firm; onSignOut: () => void }) {
  const t = useT()
  const { language, setLanguage } = useLanguage()
  return (
    <div className="px-5 pb-8 pt-6">
      <div className="flex items-center gap-4">
        <span className="grid size-16 place-items-center rounded-2xl bg-secondary text-xl font-bold">{initials(driver.name)}</span>
        <span>
          <h1 className="text-2xl font-semibold">{driver.name}</h1>
          <span className="text-sm text-muted-foreground">
            {formatPhone(driver.phone)} · ★ {driver.rating.toFixed(1)}
          </span>
        </span>
      </div>
      <section className="mt-5 rounded-2xl border bg-card p-4 text-sm">
        <h2 className="font-semibold">{t("driver.profile.firm")}</h2>
        <p className="mt-1">{firm?.name}</p>
        <p className="text-muted-foreground">{firm ? t("rider.trip.ruraLicence", { licence: firm.ruraLicenceNo }) : ""}</p>
      </section>
      <section className="mt-3 rounded-2xl border bg-card p-4 text-sm">
        <h2 className="font-semibold">{t("driver.profile.car")}</h2>
        {car ? (
          <p className="mt-1">
            <span className="font-semibold">{car.plate}</span> · {car.colour} {car.make} {car.model} · {t(`ops.power.${car.power}`)}
          </p>
        ) : (
          <p className="mt-1 text-muted-foreground">{t("driver.profile.noCar")}</p>
        )}
      </section>
      <section className="mt-3 flex flex-col gap-3 rounded-2xl border bg-card p-4 text-sm">
        <label htmlFor="driver-language" className="font-semibold">
          {t("driver.profile.language")}
        </label>
        <Select id="driver-language" value={language} onChange={(event) => setLanguage(event.target.value as Language)} className="min-h-12">
          {languages.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </Select>
        <ThemeToggle className="justify-start px-0" />
      </section>
      <a href={`mailto:${supportEmail}`} className="mt-3 flex min-h-14 items-center gap-3 rounded-2xl border bg-card px-4 text-sm font-semibold">
        <HelpCircle className="size-5" /> {t("driver.profile.help")}
      </a>
      <button onClick={onSignOut} className="mt-3 flex min-h-14 w-full items-center gap-3 rounded-2xl border bg-card px-4 text-sm font-semibold text-destructive">
        <LogOut className="size-5" /> {t("driver.profile.signOut")}
      </button>
      <p className="mt-6 text-center text-xs text-muted-foreground">{t("common.copyright")}</p>
    </div>
  )
}
