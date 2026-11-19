"use client"

import * as api from "@/lib/api"
import { firmInScope, inScope } from "@/lib/ops"
import { useLive } from "@/lib/use-live"
import { useOps } from "./ops-context"

const load = () =>
  Promise.all([
    api.getTrips(),
    api.getDrivers(),
    api.getCars(),
    api.getFirms(),
    api.getIncidents(),
    api.getOffers(),
    api.getRiders(),
    api.getCompanies(),
    api.getFeeInvoices(),
    api.getCompanyInvoices(),
    api.getCommuteRoutes(),
    api.getPricing(),
  ]).then(([trips, drivers, cars, firms, incidents, offers, riders, companies, feeInvoices, companyInvoices, routes, pricing]) => ({ trips, drivers, cars, firms, incidents, offers, riders, companies, feeInvoices, companyInvoices, routes, pricing }))

/**
 * Everything the Ops screens show, live, cut down to what the signed-in Ops user may see.
 * A firm admin sees only their firm's trips, drivers, cars, fee invoices and incidents on those trips,
 * and no company invoices or commute routes.
 */
export function useOpsData() {
  const { scope } = useOps()
  const { data, error, loading } = useLive(load, ["trips", "drivers", "cars", "firms", "incidents", "offers", "riders", "companies", "invoices", "routes", "pricing"])
  if (!data) return { data: undefined, error, loading }
  const trips = data.trips.filter(inScope(scope))
  const tripIds = new Set(trips.map((trip) => trip.id))
  return {
    error,
    loading,
    data: {
      ...data,
      trips,
      drivers: data.drivers.filter(inScope(scope)),
      cars: data.cars.filter(inScope(scope)),
      firms: data.firms.filter(firmInScope(scope)),
      // All firms, for names on reassigned trips; never listed to a firm admin.
      allFirms: data.firms,
      // A firm admin sees fee invoices once Flyt Ltd sends them, never drafts.
      feeInvoices: data.feeInvoices.filter(inScope(scope)).filter((invoice) => !scope.firmId || invoice.status !== "draft"),
      companyInvoices: scope.firmId ? [] : data.companyInvoices,
      routes: scope.firmId ? [] : data.routes,
      incidents: scope.firmId ? data.incidents.filter((incident) => incident.tripId && tripIds.has(incident.tripId)) : data.incidents,
      offers: data.offers.filter((offer) => tripIds.has(offer.tripId)),
    },
  }
}

export type OpsData = NonNullable<ReturnType<typeof useOpsData>["data"]>
