"use client"

import { useState } from "react"
import { DevSignIn } from "@/components/shared/dev-sign-in"
import { sendCode } from "@/components/rider/sign-in-screen"
import { Button } from "@/components/ui/button"
import { isDemoData } from "@/lib/api"
import { normalizePhone } from "@/lib/format"
import { useT } from "@/lib/i18n"

export function DriverSignIn({ busy, onSubmit, toast }: { busy: boolean; onSubmit: (phone: string, code: string) => void; toast: (message: string) => void }) {
  const t = useT()
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!normalizePhone(phone)) return toast(t("rider.signin.invalidPhone"))
    if (code.length !== 6) return toast(t("rider.signin.invalidCode"))
    onSubmit(phone, code)
  }
  return (
    <div className="px-5 pb-8 pt-7">
    <form onSubmit={submit}>
      <h1 className="text-2xl font-semibold">{t("driver.signin.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("driver.signin.subtitle")}</p>
      <label className="mt-6 block text-sm font-medium" htmlFor="driver-phone">
        {t("rider.signin.phone")}
      </label>
      <div className="mt-2 flex rounded-xl border bg-card">
        <span className="flex items-center border-r px-3 text-sm text-muted-foreground">+250</span>
        <input id="driver-phone" inputMode="tel" autoComplete="tel-national" placeholder="78 000 0000" value={phone} onChange={(event) => setPhone(event.target.value)} className="min-h-14 w-full rounded-r-xl bg-transparent px-3 text-lg outline-none" />
      </div>
      <Button type="button" variant="outline" className="mt-3 min-h-12 w-full" onClick={() => void sendCode(phone, toast, t)}>
        {t("rider.signin.sendCode")}
      </Button>
      <label htmlFor="driver-code" className="mt-5 block text-sm font-medium">
        {t("rider.signin.code")}
      </label>
      <input id="driver-code" inputMode="numeric" maxLength={6} autoComplete="one-time-code" placeholder="000000" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-2 min-h-14 w-full rounded-xl border bg-card px-4 text-lg tracking-[.4em] outline-none" />
      <Button type="submit" disabled={busy} className="mt-6 min-h-14 w-full text-base">
        {busy ? t("common.saving") : t("driver.signin.continue")}
      </Button>
      {isDemoData && <p className="mt-4 rounded-xl bg-secondary p-3 text-xs text-muted-foreground">{t("driver.signin.demoHint")}</p>}
    </form>
    <DevSignIn toast={toast} onSignedIn={() => onSubmit("", "")} />
    </div>
  )
}
