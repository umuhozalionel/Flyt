"use client"

import { useState } from "react"
import { Logo } from "@/components/shared/logo"
import { Button } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/input"
import * as api from "@/lib/api"
import type { AdminPortal } from "@/lib/api"
import { normalizePhone } from "@/lib/format"
import { useT } from "@/lib/i18n"
import { DevSignIn } from "./dev-sign-in"

/** Sign-in for Ops and the company portal with Supabase: phone and SMS code. The team member must be on the team list. */
export function AdminSignIn({ portal, onSignedIn, toast }: { portal: AdminPortal; onSignedIn: () => void; toast: (message: string) => void }) {
  const t = useT()
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    try {
      await action()
    } catch (error) {
      toast(error instanceof Error ? error.message : t("rider.signin.failed"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary/45 p-4">
      <div className="w-full max-w-sm rounded-3xl border bg-background p-6 shadow-sm">
        <Logo small />
        <h1 className="mt-4 text-xl font-semibold">{t(portal === "ops" ? "signin.admin.opsTitle" : "signin.admin.companyTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("signin.admin.detail")}</p>
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            void run(async () => {
              await api.signInAdmin({ phone, code, portal })
              onSignedIn()
            })
          }}
        >
          <Field id="admin-phone" label={t("rider.signin.phone")}>
            <Input id="admin-phone" type="tel" inputMode="tel" autoComplete="tel-national" required placeholder="0788 123 456" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </Field>
          <Button
            type="button"
            variant="outline"
            className="min-h-10"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                if (!normalizePhone(phone)) throw new Error(t("rider.signin.invalidPhone"))
                const result = await api.requestSignInCode(phone)
                toast(result.note ?? t("rider.signin.codeSent"))
              })
            }
          >
            {t("rider.signin.sendCode")}
          </Button>
          <Field id="admin-code" label={t("rider.signin.code")}>
            <Input id="admin-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
          </Field>
          <Button type="submit" className="min-h-11" disabled={busy || code.length !== 6}>
            {t("rider.signin.continue")}
          </Button>
        </form>
        <DevSignIn
          toast={toast}
          onSignedIn={async () => {
            const roles = await api.getSignedInAdmins(portal)
            if (!roles.length) throw new Error(t("signin.admin.noAccess"))
            onSignedIn()
          }}
        />
      </div>
    </main>
  )
}
