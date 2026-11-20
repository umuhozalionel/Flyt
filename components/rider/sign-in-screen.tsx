"use client"

import { useState } from "react"
import { DevSignIn } from "@/components/shared/dev-sign-in"
import { Button } from "@/components/ui/button"
import * as api from "@/lib/api"
import { normalizePhone } from "@/lib/format"
import { useT } from "@/lib/i18n"

type SignInInput = { phone: string; code: string; name: string; consent: boolean; joinCode?: string }

export function SignInScreen({ busy, onSubmit, toast }: { busy: boolean; onSubmit: (input: SignInInput) => void; toast: (message: string) => void }) {
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
    onSubmit({ phone, code, name, consent, joinCode: showCode && joinCode.trim() ? joinCode.trim() : undefined })
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
      <Button variant="outline" className="mt-3 min-h-11 w-full" onClick={() => void sendCode(phone, toast, t)}>
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
      {api.isDemoData && <p className="mt-5 text-center text-xs text-muted-foreground">{t("rider.signin.demoNote")}</p>}
      <DevSignIn toast={toast} onSignedIn={() => onSubmit({ phone: "", code: "", name: "", consent: false })} />
    </div>
  )
}

/** Asks for an SMS code. With Supabase this sends it; the demo sends nothing and takes any 6 digits. */
export async function sendCode(phone: string, toast: (message: string) => void, t: ReturnType<typeof useT>) {
  if (!normalizePhone(phone)) return toast(t("rider.signin.invalidPhone"))
  try {
    const result = await api.requestSignInCode(phone)
    toast(result.note ?? t(api.isDemoData ? "rider.signin.codeSent" : "signin.codeSentSms"))
  } catch (error) {
    toast(error instanceof Error ? error.message : t("rider.signin.failed"))
  }
}
