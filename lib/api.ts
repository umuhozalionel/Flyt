import { dataSource } from "./config"
import { mockSource } from "./data/mock"
import { supabaseSource } from "./data/supabase"
import type { DataSource } from "./data/types"

// The only data door for screens. It forwards every call to the data source picked by
// NEXT_PUBLIC_DATA_SOURCE (mock by default). Screens never import mock data or Supabase directly.
const source: DataSource = dataSource === "supabase" ? supabaseSource : mockSource

export type { BookingInput, QuoteInput, RideQuote, RiderProfileUpdate, Topic, TripAssignment } from "./data/types"

export const subscribe: DataSource["subscribe"] = (topics, callback) => source.subscribe(topics, callback)

export const getFirms = () => source.getFirms()
export const getCompanies = () => source.getCompanies()
export const getRiders = () => source.getRiders()
export const getRider: DataSource["getRider"] = (id) => source.getRider(id)
export const getDrivers = () => source.getDrivers()
export const getCars = () => source.getCars()
export const getTrips = () => source.getTrips()
export const getTrip: DataSource["getTrip"] = (id) => source.getTrip(id)
export const getRiderTrips: DataSource["getRiderTrips"] = (riderId) => source.getRiderTrips(riderId)
export const getTripAssignment: DataSource["getTripAssignment"] = (tripId) => source.getTripAssignment(tripId)
export const getOffers: DataSource["getOffers"] = (driverId) => source.getOffers(driverId)
export const getCommuteRoutes = () => source.getCommuteRoutes()
export const getFeeInvoices = () => source.getFeeInvoices()
export const getCompanyInvoices = () => source.getCompanyInvoices()
export const getIncidents = () => source.getIncidents()
export const getPricing = () => source.getPricing()
export const getAdmins = () => source.getAdmins()

export const signInRider: DataSource["signInRider"] = (input) => source.signInRider(input)
export const updateRider: DataSource["updateRider"] = (riderId, update) => source.updateRider(riderId, update)

export const quoteTrip: DataSource["quoteTrip"] = (input) => source.quoteTrip(input)
export const createBooking: DataSource["createBooking"] = (input) => source.createBooking(input)
export const assignDriver: DataSource["assignDriver"] = (tripId, driverId) => source.assignDriver(tripId, driverId)
export const reassignDriver: DataSource["reassignDriver"] = (tripId, driverId) => source.reassignDriver(tripId, driverId)
export const respondOffer: DataSource["respondOffer"] = (offerId, accept) => source.respondOffer(offerId, accept)
export const driverArrived: DataSource["driverArrived"] = (tripId) => source.driverArrived(tripId)
export const startTrip: DataSource["startTrip"] = (tripId) => source.startTrip(tripId)
export const endTrip: DataSource["endTrip"] = (tripId) => source.endTrip(tripId)
export const cancelTrip: DataSource["cancelTrip"] = (tripId, by, reason) => source.cancelTrip(tripId, by, reason)
export const markNoDriverFound: DataSource["markNoDriverFound"] = (tripId) => source.markNoDriverFound(tripId)

export const riderMarkPaid: DataSource["riderMarkPaid"] = (tripId) => source.riderMarkPaid(tripId)
export const confirmPayment: DataSource["confirmPayment"] = (tripId, received) => source.confirmPayment(tripId, received)
export const rateTrip: DataSource["rateTrip"] = (tripId, rating, tags, comment) => source.rateTrip(tripId, rating, tags, comment)
export const rateRider: DataSource["rateRider"] = (tripId, rating) => source.rateRider(tripId, rating)

export const setDriverPresence: DataSource["setDriverPresence"] = (driverId, presence) => source.setDriverPresence(driverId, presence)

export const setActivePlan: DataSource["setActivePlan"] = (name) => source.setActivePlan(name)
export const updatePlan: DataSource["updatePlan"] = (name, values) => source.updatePlan(name, values)
export const updateAirportZones: DataSource["updateAirportZones"] = (zones) => source.updateAirportZones(zones)
export const setFirmFee: DataSource["setFirmFee"] = (firmId, feePercent) => source.setFirmFee(firmId, feePercent)

export const reportIncident: DataSource["reportIncident"] = (input) => source.reportIncident(input)

export const resetDemo = () => source.resetDemo?.() ?? Promise.resolve()
export const isDemoData = dataSource === "mock"
