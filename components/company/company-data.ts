"use client"

import * as api from "@/lib/api"
import { companyStaff, companyTrips } from "@/lib/company"
import { useLive } from "@/lib/use-live"
import { useCompany } from "./company-context"

const load = () =>
  Promise.all([api.getCompanies(), api.getTrips(), api.getRiders(), api.getCompanyInvoices(), api.getCommuteRoutes(), api.getFirms()]).then(([companies, trips, riders, invoices, routes, firms]) => ({ companies, trips, riders, invoices, routes, firms }))

/**
 * What a company admin may see, live: their company, its staff, trips billed to the company and
 * shared commute seats (never staff's own MoMo or Airtel rides), its invoices and its commute routes.
 */
export function useCompanyData() {
  const { companyId } = useCompany()
  const { data, error } = useLive(load, ["companies", "trips", "riders", "invoices", "routes", "firms"])
  if (!data || !companyId) return { data: undefined, error }
  const company = data.companies.find((item) => item.id === companyId)
  if (!company) return { data: undefined, error: error ?? new Error("Company not found") }
  const staff = companyStaff(data.riders, companyId)
  const trips = companyTrips(data.trips, companyId)
  // Names for past trips by people who have since left the staff list.
  const riderIds = new Set(trips.map((trip) => trip.riderId))
  return {
    error,
    data: {
      company,
      staff,
      trips,
      people: data.riders.filter((rider) => rider.companyId === companyId || riderIds.has(rider.id)),
      // Drafts stay inside Flyt Operations until they are sent.
      invoices: data.invoices.filter((invoice) => invoice.companyId === companyId && invoice.status !== "draft").sort((a, b) => b.period.localeCompare(a.period)),
      routes: data.routes.filter((route) => route.companyId === companyId),
      firms: data.firms,
    },
  }
}

export type CompanyData = NonNullable<ReturnType<typeof useCompanyData>["data"]>
