"use client"

import Link from "next/link"
import { ArrowUpRight, BadgeCheck, CarFront, ChartNoAxesCombined, Clock3, MapPin, ShieldCheck, Smartphone, Users } from "lucide-react"
import { Logo } from "@/components/shared/logo"
import { ThemeToggle } from "@/components/shared/theme"
import { contactEmail } from "@/lib/config"
import { useT, type TranslationKey } from "@/lib/i18n"

const demos: { title: TranslationKey; description: TranslationKey; href: string; icon: typeof MapPin; tint: string }[] = [
  { title: "start.rider", description: "start.riderDetail", href: "/rider", icon: MapPin, tint: "bg-primary text-primary-foreground" },
  { title: "start.driver", description: "start.driverDetail", href: "/driver", icon: CarFront, tint: "bg-secondary text-foreground" },
  { title: "start.ops", description: "start.opsDetail", href: "/ops", icon: ChartNoAxesCombined, tint: "bg-secondary text-foreground" },
  { title: "start.company", description: "start.companyDetail", href: "/company", icon: Users, tint: "bg-secondary text-foreground" },
]

export default function Page() {
  const t = useT()
  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-5 sm:px-8">
        <Logo />
        <span className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
          <span className="size-2 rounded-full bg-emerald-500" /> {t("start.location")}
        </span>
        <span className="flex items-center gap-1">
          <ThemeToggle />
          <a href={`mailto:${contactEmail}`} className="inline-flex min-h-11 items-center text-sm font-semibold">
            {t("start.contact")} <ArrowUpRight className="ml-1 inline size-4" />
          </a>
        </span>
      </header>
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-16 pt-8 sm:px-8 lg:grid-cols-[1.1fr_.9fr] lg:gap-16 lg:pb-24 lg:pt-14">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold">
            <BadgeCheck className="size-4 text-primary" /> {t("start.badge")}
          </div>
          <h1 className="mt-6 max-w-2xl text-5xl font-semibold leading-[1.04] tracking-[-.055em] sm:text-6xl lg:text-7xl">
            {t("start.headline1")}
            <br />
            <span className="text-primary">{t("start.headline2")}</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-muted-foreground">{t("start.intro")}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-2">
              <ShieldCheck className="size-4 text-primary" /> {t("start.verified")}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-2">
              <Clock3 className="size-4 text-primary" /> {t("start.priceFirst")}
            </span>
          </div>
          <div className="mt-10 grid max-w-xl gap-3 sm:grid-cols-2">
            {demos.map(({ title, description, href, icon: Icon, tint }) => (
              <Link key={title} href={href} className="group flex min-h-24 items-center gap-4 rounded-2xl border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
                <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${tint}`}>
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t(title)}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">{t(description)}</span>
                </span>
                <ArrowUpRight className="size-4 text-muted-foreground transition group-hover:text-primary" />
              </Link>
            ))}
          </div>
          <p className="mt-6 text-xs text-muted-foreground">{t("start.demoNote")}</p>
        </div>
        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute -right-16 -top-12 size-60 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative rounded-[2.25rem] border bg-card p-3 shadow-2xl shadow-primary/10">
            <div className="overflow-hidden rounded-[1.7rem] bg-[#f4f6f2] p-5 dark:bg-secondary">
              <div className="flex items-center justify-between">
                <Logo small />
                <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold shadow-sm dark:bg-background">{t("start.mock.city")}</span>
              </div>
              <div className="mt-5 overflow-hidden rounded-3xl border bg-[#e8eee5] dark:bg-background">
                <div className="map-grid relative h-56">
                  <div className="absolute left-[20%] top-[25%] size-20 rounded-full bg-emerald-200/40 blur-xl" />
                  <div className="absolute left-[18%] top-[38%] rounded-full border-4 border-white bg-primary p-2">
                    <MapPin className="size-4 text-primary-foreground" />
                  </div>
                  <div className="absolute right-[24%] top-[55%] rounded-full border-4 border-white bg-foreground p-2">
                    <MapPin className="size-4 text-background" />
                  </div>
                  <div className="absolute left-[56%] top-[22%] grid size-10 place-items-center rounded-xl border-4 border-white bg-white shadow">
                    <CarFront className="size-5 text-primary" />
                  </div>
                  <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-foreground dark:bg-card">{t("start.mock.area")}</span>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border bg-background p-4">
                <p className="text-xs text-muted-foreground">{t("start.mock.greeting")}</p>
                <p className="mt-1 text-lg font-semibold">{t("start.mock.question")}</p>
                <div className="mt-4 flex items-center gap-3 rounded-xl bg-secondary p-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-background">
                    <MapPin className="size-4" />
                  </span>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("start.mock.destination")}</p>
                    <p className="text-sm font-medium">{t("start.mock.destinationName")}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t("start.mock.option")}</span>
                  <span className="font-bold">{t("start.mock.price")}</span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-primary p-3.5 text-sm font-semibold text-primary-foreground">
                <Smartphone className="size-4" /> {t("start.mock.book")}
              </div>
            </div>
          </div>
          <div className="absolute -bottom-5 -left-6 hidden items-center gap-3 rounded-2xl border bg-card p-4 shadow-xl sm:flex">
            <div className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <BadgeCheck className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">{t("start.rura")}</p>
              <p className="text-xs text-muted-foreground">{t("start.ruraDetail")}</p>
            </div>
          </div>
        </div>
      </section>
      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>{t("common.copyright")}</span>
          <div className="flex gap-5">
            <a href="#terms" className="hover:text-foreground">
              {t("common.terms")}
            </a>
            <a href="#privacy" className="hover:text-foreground">
              {t("common.privacy")}
            </a>
            <span>{t("start.location")}</span>
          </div>
        </div>
      </footer>
    </main>
  )
}
