"use client"

import { ChartNoAxesCombined, FileText, ListChecks, Route, Users } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { Logo } from "@/components/shared/logo"
import { NotificationBell } from "@/components/shared/notification-center"
import { ThemeToggle } from "@/components/shared/theme"
import { Toast, useToastMessage } from "@/components/shared/toast"
import { Select } from "@/components/ui/input"
import * as api from "@/lib/api"
import { useT, type TranslationKey } from "@/lib/i18n"
import { useLive } from "@/lib/use-live"
import { CompanyProvider, useCompany } from "./company-context"

const nav: { href: string; label: TranslationKey; icon: typeof Users }[] = [
  { href: "/company", label: "company.nav.overview", icon: ChartNoAxesCombined },
  { href: "/company/staff", label: "company.nav.staff", icon: Users },
  { href: "/company/trips", label: "company.nav.trips", icon: ListChecks },
  { href: "/company/invoices", label: "company.nav.invoices", icon: FileText },
  { href: "/company/routes", label: "company.nav.routes", icon: Route },
]

/** Company portal layout: top bar with the demo admin switcher, and tabs. Desktop-first, works on phones. */
export function CompanyShell({ children }: { children: ReactNode }) {
  const t = useT()
  const { message, toast, clear } = useToastMessage()
  return (
    <>
      <CompanyProvider toast={toast}>
        <div className="min-h-screen bg-background text-foreground">
          <TopBar />
          <main className="mx-auto max-w-6xl px-4 pb-16 pt-5 sm:px-6">{children}</main>
          <footer className="mx-auto max-w-6xl px-4 pb-6 text-xs text-muted-foreground sm:px-6">{t("common.copyright")}</footer>
        </div>
      </CompanyProvider>
      {message && <Toast message={message} onClose={clear} />}
    </>
  )
}

function TopBar() {
  const t = useT()
  const pathname = usePathname()
  const { admins, admin, setAdminId } = useCompany()
  const { data: companies } = useLive(api.getCompanies, ["companies"])
  const active = (href: string) => (href === "/company" ? pathname === "/company" : pathname.startsWith(href))
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" aria-label={t("common.homeLink")}>
          <Logo small />
        </Link>
        <span className="text-sm font-semibold text-muted-foreground">{t("company.title")}</span>
        <div className="ml-auto flex w-full min-w-0 items-center gap-2 sm:w-auto">
          <label htmlFor="company-admin" className="shrink-0 text-xs font-medium text-muted-foreground">
            {t("company.signedInAs")}
          </label>
          <Select id="company-admin" value={admin?.id ?? ""} onChange={(event) => setAdminId(event.target.value)} className="min-w-0 flex-1 sm:w-auto sm:max-w-[18rem] sm:flex-none">
            {admins.map((item) => (
              <option key={item.id} value={item.id}>
                {t("company.adminOption", { name: item.name, company: companies?.find((company) => company.id === item.companyId)?.name ?? "" })}
              </option>
            ))}
          </Select>
          {admin && <NotificationBell viewer={{ kind: "admin", id: admin.id }} portalLink="/company" />}
          <ThemeToggle />
        </div>
      </div>
      <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2 sm:px-5" aria-label={t("company.nav.label")}>
        {nav.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-medium ${active(href) ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
            <Icon className="size-4" /> {t(label)}
          </Link>
        ))}
      </nav>
    </header>
  )
}
