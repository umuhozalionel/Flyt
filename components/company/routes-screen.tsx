"use client"

import { RouteCard } from "@/components/ops/commutes-screen"
import { useT } from "@/lib/i18n"
import { useCompanyData } from "./company-data"
import { LoadError, NoCompany, PageHeader } from "./company-ui"

/** The company's shared commute routes and who rides each. */
export function CompanyRoutes() {
  const t = useT()
  const { data, error } = useCompanyData()
  if (error && !data) return <LoadError error={error} />
  if (!data) return <NoCompany />
  return (
    <>
      <PageHeader title={t("company.routes.title")} detail={t("company.routes.detail")} />
      {data.routes.length ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {data.routes.map((route) => (
            <RouteCard key={route.id} route={route} riders={data.people} trips={data.trips} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("company.routes.none")}</p>
      )}
    </>
  )
}
