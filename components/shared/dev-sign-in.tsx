"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/input"
import * as api from "@/lib/api"
import { devSignIn } from "@/lib/config"
import { useT } from "@/lib/i18n"

/**
 * Local development only: email and password sign-in for seeded people (<id>@flyt.test).
 * Shown only when NEXT_PUBLIC_DEV_SIGNIN=true against a local Supabase (see lib/config.ts). Never in production.
 */
export function DevSignIn({ onSignedIn, toast }: { onSignedIn: () => void | Promise<void>; toast: (message: string) => void }) {
  const t = useT()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  if (!devSignIn) return null
  return (
    <form
      className="mt-6 flex flex-col gap-2 rounded-xl border border-dashed p-3"
      onSubmit={(event) => {
        event.preventDefault()
        setBusy(true)
        void api
          .devSignIn(email.trim(), password)
          .then(onSignedIn)
          .catch((error: unknown) => toast(error instanceof Error ? error.message : t("rider.signin.failed")))
          .finally(() => setBusy(false))
      }}
    >
      <p className="text-xs font-semibold text-muted-foreground">{t("signin.dev.title")}</p>
      <Field id="dev-email" label={t("signin.dev.email")}>
        <Input id="dev-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="rider-1@flyt.test" />
      </Field>
      <Field id="dev-password" label={t("signin.dev.password")}>
        <Input id="dev-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
      </Field>
      <Button type="submit" variant="outline" className="min-h-10" disabled={busy}>
        {t("signin.dev.submit")}
      </Button>
    </form>
  )
}
