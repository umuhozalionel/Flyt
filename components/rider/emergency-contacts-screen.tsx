"use client"

import { Phone, Trash2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { normalizePhone } from "@/lib/format"
import { useT } from "@/lib/i18n"
import type { EmergencyContact, Rider } from "@/lib/types"

export function EmergencyContactsScreen({ rider, busy, onSave, toast }: { rider: Rider; busy: boolean; onSave: (contacts: EmergencyContact[]) => Promise<void>; toast: (message: string) => void }) {
  const t = useT()
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")

  async function add() {
    const normalized = normalizePhone(phone)
    if (!name.trim()) return toast(t("rider.contacts.nameNeeded"))
    if (!normalized) return toast(t("rider.signin.invalidPhone"))
    await onSave([...rider.emergencyContacts, { id: `ec-${Date.now()}`, name: name.trim(), phone: normalized }])
    setName("")
    setPhone("")
  }

  return (
    <div className="px-5 pb-8 pt-6">
      <h1 className="text-2xl font-semibold">{t("rider.contacts.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("rider.contacts.detail")}</p>
      <div className="mt-5 flex flex-col gap-2">
        {rider.emergencyContacts.length === 0 && <EmptyState title={t("rider.contacts.emptyTitle")} detail={t("rider.contacts.emptyDetail")} />}
        {rider.emergencyContacts.map((contact) => (
          <div key={contact.id} className="flex min-h-14 items-center gap-3 rounded-2xl border bg-card px-4">
            <Phone className="size-4 text-muted-foreground" />
            <span className="flex-1">
              <span className="block text-sm font-semibold">{contact.name}</span>
              <span className="block text-xs text-muted-foreground">{contact.phone}</span>
            </span>
            <button disabled={busy} onClick={() => void onSave(rider.emergencyContacts.filter((item) => item.id !== contact.id))} className="grid size-11 place-items-center rounded-full hover:bg-secondary" aria-label={t("rider.contacts.remove", { name: contact.name })}>
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-2xl border bg-card p-4">
        <h2 className="font-semibold">{t("rider.contacts.add")}</h2>
        <label htmlFor="contact-name" className="mt-3 block text-sm font-medium">
          {t("rider.contacts.name")}
        </label>
        <input id="contact-name" value={name} onChange={(event) => setName(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border bg-background px-4 outline-none" />
        <label htmlFor="contact-phone" className="mt-3 block text-sm font-medium">
          {t("rider.signin.phone")}
        </label>
        <input id="contact-phone" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="078 000 0000" className="mt-2 min-h-12 w-full rounded-xl border bg-background px-4 outline-none" />
        <Button className="mt-4 min-h-12 w-full" disabled={busy} onClick={() => void add()}>
          {t("rider.contacts.save")}
        </Button>
      </div>
    </div>
  )
}
