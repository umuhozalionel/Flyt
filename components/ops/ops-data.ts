"use client"

import * as api from "@/lib/api"
import { firmInScope, inScope } from "@/lib/ops"
import { useLive } from "@/lib/use-live"
import { useOps } from "./ops-context"

const load = () =>
  Promise.all([api.getTrips(), api.getDrivers(), api.getCars(), api.getFirms(), api.getIncidents(), api.getOffers(), api.getRiders(), api.getCompanies(), api.getFeeInvoices()]).then(
    ([trips, drivers, cars, firms, incidents, offers, riders, companies, feeInvoices]) => ({ trips, drivers, cars, firms, incidents, offers, riders, companies, feeInvoices }),
  )

/**
 * Everything the Ops screens show, live, cut down to what the signed-in Ops user may see.
 * A firm admin sees only their firm's trips, drivers, cars, invoices and incidents on those trips.
 */
export function useOpsData() {
  const { scope } = useOps()
  const { data, error, loading } = useLive(load, ["trips", "drivers", "cars", "firms", "incidents", "offers", "riders", "companies", "invoices"])
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
      feeInvoices: data.feeInvoices.filter(inScope(scope)),
      incidents: scope.firmId ? data.incidents.filter((incident) => incident.tripId && tripIds.has(incident.tripId)) : data.incidents,
      offers: data.offers.filter((offer) => tripIds.has(offer.tripId)),
    },
  }
}

export type OpsData = NonNullable<ReturnType<typeof useOpsData>["data"]>
