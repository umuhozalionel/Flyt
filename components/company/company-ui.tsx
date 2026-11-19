"use client"

import { Card, Facts, Kpi, LoadError, Loading, PageHeader } from "@/components/ops/ops-ui"
import { useT } from "@/lib/i18n"
import { useCompany } from "./company-context"

// The company portal reuses the Ops panels so both dashboards look and behave the same.
export { Card, Facts, Kpi, LoadError, Loading, PageHeader }

/** Shown while no company admin exists to sign in as. */
export function NoCompany() {
  const t = useT()
  const { admins } = useCompany()
  return admins.length ? <Loading /> : <p className="text-sm text-muted-foreground">{t("company.noAdmin")}</p>
}
