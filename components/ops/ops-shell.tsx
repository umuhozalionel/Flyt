"use client"

import { CarFront, ChartNoAxesCombined, Building2, IdCard, ListChecks, Radio } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { Logo } from "@/components/shared/logo"
import { ThemeToggle } from "@/components/shared/theme"
import { Toast } from "@/components/shared/toast"
import { Select } from "@/components/ui/input"
import * as api from "@/lib/api"
import { useT, type TranslationKey } from "@/lib/i18n"
import { useLive } from "@/lib/use-live"
import { OpsProvider, useOps, useToastMessage } from "./ops-context"

const nav: { href: string; label: TranslationKey; icon: typeof Radio }[] = [
  { href: "/ops", label: "ops.nav.overview", icon: ChartNoAxesCombined },
  { href: "/ops/dispatch", label: "ops.nav.dispatch", icon: Radio },
  { href: "/ops/trips", label: "ops.nav.trips", icon: ListChecks },
  { href: "/ops/firms", label: "ops.nav.firms", icon: Building2 },
  { href: "/ops/drivers", label: "ops.nav.drivers", icon: IdCard },
  { href: "/ops/cars", label: "ops.nav.cars", icon: CarFront },
]

/** Flyt Operations layout: sidebar on desktop, scrolling tabs on small screens, and the demo role switcher. */
export function OpsShell({ children }: { children: ReactNode }) {
  const { message, toast, clear } = useToastMessage()
  return (
    <OpsProvider toast={toast}>
      <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[232px_1fr]">
        <Sidebar />
        <div className="min-w-0">
          <TopBar />
          <main className="mx-auto max-w-7xl px-4 pb-16 pt-5 sm:px-6">{children}</main>
        </div>
      </div>
      {message && <Toast message={message} onClose={clear} />}
    </OpsProvider>
  )
}

function useActive() {
  const pathname = usePathname()
  return (href: string) => (href === "/ops" ? pathname === "/ops" : pathname.startsWith(href))
}

function Sidebar() {
  const t = useT()
  const active = useActive()
  return (
    <aside className="sticky top-0 hidden h-screen flex-col border-r bg-sidebar p-4 lg:flex">
      <Link href="/" aria-label={t("common.homeLink")}>
        <Logo small />
      </Link>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("ops.title")}</p>
      <nav className="mt-6 flex flex-col gap-1" aria-label={t("ops.nav.label")}>
        {nav.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={`flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium ${active(href) ? "bg-primary text-primary-foreground" : "hover:bg-sidebar-accent"}`}>
            <Icon className="size-4" /> {t(label)}
          </Link>
        ))}
      </nav>
      <p className="mt-auto text-xs text-muted-foreground">{t("common.copyright")}</p>
    </aside>
  )
}

function TopBar() {
  const t = useT()
  const active = useActive()
  const { admins, admin, setAdminId } = useOps()
  const { data: firms } = useLive(api.getFirms, ["firms"])
  const roleLabel = (id: string) => {
    const item = admins.find((row) => row.id === id)
    if (!item) return ""
    return item.role === "platform_admin" ? t("ops.role.platform", { name: item.name }) : t("ops.role.firm", { name: item.name, firm: firms?.find((firm) => firm.id === item.firmId)?.name ?? "" })
  }
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="lg:hidden" aria-label={t("common.homeLink")}>
          <Logo small />
        </Link>
        <h1 className="hidden text-lg font-semibold lg:block">{t("ops.title")}</h1>
        <div className="ml-auto flex w-full min-w-0 items-center gap-2 sm:w-auto">
          <label htmlFor="ops-role" className="shrink-0 text-xs font-medium text-muted-foreground">
            {t("ops.role.label")}
          </label>
          <Select id="ops-role" value={admin?.id ?? ""} onChange={(event) => setAdminId(event.target.value)} className="min-w-0 flex-1 sm:w-auto sm:max-w-[17rem] sm:flex-none">
            {admins.map((item) => (
              <option key={item.id} value={item.id}>
                {roleLabel(item.id)}
              </option>
            ))}
          </Select>
          <ThemeToggle />
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden" aria-label={t("ops.nav.label")}>
        {nav.map(({ href, label }) => (
          <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={`shrink-0 rounded-full px-3 py-2 text-sm font-medium ${active(href) ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
            {t(label)}
          </Link>
        ))}
      </nav>
    </header>
  )
}
