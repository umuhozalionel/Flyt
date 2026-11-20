"use client"

import { Lock, MessageCircle, Send } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/shared/skeleton"
import * as api from "@/lib/api"
import { hasPhoneNumber, quickReplies } from "@/lib/additions"
import { formatTime } from "@/lib/format"
import { useT, type TranslationKey } from "@/lib/i18n"
import type { ChatChannel, ChatSender } from "@/lib/types"
import { useLive } from "@/lib/use-live"

/**
 * Trip chat. Rider and driver (rider_driver), or company admin and driver on a company-billed trip
 * (company_driver). Open only while the trip is active, or for 24 hours after a lost-item report.
 * Phone numbers cannot be sent (rule c), and no phone number is shown here.
 */
export function ChatPanel(props: { tripId: string; channel: ChatChannel; me: { sender: ChatSender; senderId: string }; open: boolean; otherName: string; onClose: () => void; toast: (message: string) => void }) {
  const t = useT()
  const chat = useLive(() => api.getChat(props.tripId, props.channel), ["chat"], [props.tripId, props.channel])
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const messages = chat.data ?? []

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" })
  }, [messages.length])

  async function send(body: string, quickReply = false) {
    if (!body.trim()) return
    if (hasPhoneNumber(body)) return props.toast(t("chat.noPhones"))
    setBusy(true)
    try {
      await api.sendChat({ tripId: props.tripId, channel: props.channel, body, quickReply, from: props.me })
      setText("")
    } catch (error) {
      props.toast(error instanceof Error ? error.message : t("chat.failed"))
    } finally {
      setBusy(false)
    }
  }

  const labelFor = (sender: ChatSender) => (sender === props.me.sender ? t("chat.you") : props.otherName)

  return (
    <Dialog title={t(props.channel === "company_driver" ? "chat.companyTitle" : "chat.title", { name: props.otherName })} description={t("chat.note")} onClose={props.onClose} closeLabel={t("common.close")}>
      <div className="flex h-[min(60vh,440px)] flex-col">
        <div className="flex-1 overflow-y-auto rounded-2xl bg-secondary/50 p-3" aria-live="polite">
          {messages.length ? (
            <ul className="flex flex-col gap-2">
              {messages.map((message) => {
                const mine = message.sender === props.me.sender
                return (
                  <li key={message.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                    <span className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-card"}`}>{message.body}</span>
                    <span className="mt-0.5 text-[10px] text-muted-foreground">
                      {labelFor(message.sender)} · {formatTime(message.createdAt)}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            chat.loading ? (
              <div className="flex flex-col gap-2 py-4" aria-busy>
                <Skeleton className="h-10 w-2/3" />
                <Skeleton className="ml-auto h-10 w-1/2" />
              </div>
            ) : (
              <p className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                <MessageCircle className="size-6 text-primary" /> {t("chat.empty")}
              </p>
            )
          )}
          <div ref={end} />
        </div>
        {props.open ? (
          <>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t("chat.quick")}>
              {quickReplies[props.me.sender].map((reply) => {
                const label = t(`chat.quick.${reply}` as TranslationKey)
                return (
                  <button key={reply} disabled={busy} onClick={() => void send(label, true)} className="min-h-10 shrink-0 rounded-full border bg-card px-3 text-sm font-medium hover:border-primary">
                    {label}
                  </button>
                )
              })}
            </div>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                void send(text)
              }}
            >
              <label className="sr-only" htmlFor="chat-input">
                {t("chat.write")}
              </label>
              <input id="chat-input" value={text} maxLength={500} onChange={(event) => setText(event.target.value)} placeholder={t("chat.write")} className="min-h-12 flex-1 rounded-xl border bg-background px-3 text-sm" autoComplete="off" />
              <Button type="submit" className="min-h-12 min-w-12" disabled={busy || !text.trim()} aria-label={t("chat.send")}>
                <Send className="size-4" />
              </Button>
            </form>
          </>
        ) : (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-secondary p-3 text-sm text-muted-foreground">
            <Lock className="size-4" /> {t("chat.closed")}
          </p>
        )}
      </div>
    </Dialog>
  )
}
