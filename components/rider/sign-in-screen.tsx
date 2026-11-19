"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { normalizePhone } from "@/lib/format"
import { useT } from "@/lib/i18n"

export function SignInScreen({ busy, onSubmit, toast }: { busy: boolean; onSubmit: (input: { phone: string; name: string; consent: boolean; joinCode?: string }) => void; toast: (message: string) => void }) {
  const t = useT()
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [consent, setConsent] = useState(false)
  const [showCode, setShowCode] = useState(false)
  const [joinCode, setJoinCode] = useState("")

  function submit() {
    if (!normalizePhone(phone)) return toast(t("rider.signin.invalidPhone"))
    if (code.length !== 6) return toast(t("rider.signin.invalidCode"))
    onSubmit({ phone, name, consent, joinCode: showCode && joinCode.trim() ? joinCode.trim() : undefined })
  }

  return (
    <div className="px-5 pb-8 pt-7">
      <h1 className="text-2xl font-semibold">{t("rider.signin.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("rider.signin.subtitle")}</p>
      <label className="mt-6 block text-sm font-medium" htmlFor="phone">
        {t("rider.signin.phone")}
      </label>
      <div className="mt-2 flex rounded-xl border bg-card">
        <span className="flex items-center border-r px-3 text-sm text-muted-foreground">+250</span>
        <input id="phone" inputMode="tel" autoComplete="tel-national" placeholder="78 000 0000" value={phone} onChange={(event) => setPhone(event.target.value)} className="min-h-12 w-full rounded-r-xl bg-transparent px-3 outline-none" />
      </div>
      <Button variant="outline" className="mt-3 min-h-11 w-full" onClick={() => toast(normalizePhone(phone) ? t("rider.signin.codeSent") : t("rider.signin.invalidPhone"))}>
        {t("rider.signin.sendCode")}
      </Button>
      <label htmlFor="sms-code" className="mt-5 block text-sm font-medium">
        {t("rider.signin.code")}
      </label>
      <input id="sms-code" inputMode="numeric" maxLength={6} autoComplete="one-time-code" placeholder="000000" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-2 min-h-12 w-full rounded-xl border bg-card px-4 tracking-[.4em] outline-none" />
      <label htmlFor="full-name" className="mt-5 block text-sm font-medium">
        {t("rider.signin.name")} <span className="text-muted-foreground">{t("rider.signin.newRiders")}</span>
      </label>
      <input id="full-name" value={name} onChange={(event) => setName(event.target.value)} placeholder={t("rider.signin.namePlaceholder")} className="mt-2 min-h-12 w-full rounded-xl border bg-card px-4 outline-none" />
      <label className="mt-4 flex items-start gap-3 text-sm leading-5">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 size-4 accent-primary" />
        <span>
          {t("rider.signin.agreePrefix")}{" "}
          <button className="text-primary underline" onClick={() => toast(t("rider.signin.terms"))}>
            {t("rider.signin.terms")}
          </button>{" "}
          {t("rider.signin.and")}{" "}
          <button className="text-primary underline" onClick={() => toast(t("rider.signin.privacy"))}>
            {t("rider.signin.privacy")}
          </button>
          .
        </span>
      </label>
      {showCode ? (
        <div className="mt-4">
          <label htmlFor="join-code" className="block text-sm font-medium">
            {t("rider.signin.companyCodeLabel")}
          </label>
          <input id="join-code" value={joinCode} onChange={(event) => setJoinCode(event.target.value)} autoCapitalize="characters" placeholder="AKAGERA-24" className="mt-2 min-h-12 w-full rounded-xl border bg-card px-4 uppercase outline-none" />
          <p className="mt-1 text-xs text-muted-foreground">{t("rider.signin.companyCodeHint")}</p>
        </div>
      ) : (
        <button onClick={() => setShowCode(true)} className="mt-4 min-h-11 w-full text-sm font-medium text-primary">
          {t("rider.signin.companyCode")}
        </button>
      )}
      <Button onClick={submit} disabled={busy} className="mt-5 min-h-14 w-full">
        {t("rider.signin.continue")}
      </Button>
      <p className="mt-5 text-center text-xs text-muted-foreground">{t("rider.signin.demoNote")}</p>
    </div>
  )
}
