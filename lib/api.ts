import { cars, companies, drivers, firms, incidents, pricingPlan, riders, trips } from "./mock-data"
import type { PaymentMethod, Trip, TripStatus, TripType } from "./types"
import { calculateFare, fareSplit } from "./pricing"
const delay = (ms = 220) => new Promise<void>((resolve) => setTimeout(resolve, ms))
export async function getTrips() { await delay(); return [...trips] }
export async function getRiderDemoData() { await delay(); return { firms: [...firms], drivers: [...drivers], cars: [...cars], companies: [...companies], riders: [...riders], trips: [...trips] } }
export async function createRider(input: { name: string; phone: string }) { await delay(); const rider = { ...riders[0], id: `rider-demo-${Date.now()}`, name: input.name, phone: input.phone }; riders.unshift(rider); return rider }
export async function getTrip(id: string) { await delay(); return trips.find((trip) => trip.id === id) }
export async function getFirms() { await delay(); return [...firms] }
export async function getDrivers() { await delay(); return [...drivers] }
export async function getCars() { await delay(); return [...cars] }
export async function getCompanies() { await delay(); return [...companies] }
export async function getRiders() { await delay(); return [...riders] }
export async function getIncidents() { await delay(); return [...incidents] }
export async function getPricing() { await delay(); return { ...pricingPlan } }
export async function getRiderTrips(riderId: string) { await delay(); return trips.filter((trip) => trip.riderId === riderId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }
export async function createBooking(input: { riderId: string; pickup: string; dropoff: string; distanceKm: number; type: TripType; paymentMethod: PaymentMethod; scheduledFor?: string }): Promise<Trip> {
  await delay(500)
  const firm = firms.find((item) => item.status === "active")!
  const fare = calculateFare(input.distanceKm, input.type)
  const split = fareSplit(fare, firm.feePercent)
  const trip: Trip = { id: `FLT-${Date.now().toString().slice(-6)}`, ...input, firmId: firm.id, driverId: undefined, carId: undefined, fare, platformFee: split.platformFee, status: input.scheduledFor ? "scheduled" : "requested", paymentStatus: input.paymentMethod === "company_account" ? "billed_to_company" : "pending", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  trips.unshift(trip)
  return trip
}
export async function assignDriver(tripId: string, driverId: string) { await delay(); const trip = trips.find((item) => item.id === tripId); const driver = drivers.find((item) => item.id === driverId); const car = cars.find((item) => item.firmId === driver?.firmId); if (!trip || !driver || !car) throw new Error("Unable to assign a driver"); Object.assign(trip, { driverId, carId: car.id, firmId: driver.firmId, status: "driver_arriving" as TripStatus, updatedAt: new Date().toISOString() }); driver.status = "on_trip"; return trip }
export async function updateTripStatus(tripId: string, status: TripStatus) { await delay(); const trip = trips.find((item) => item.id === tripId); if (!trip) throw new Error("Trip not found"); trip.status = status; trip.updatedAt = new Date().toISOString(); if (status === "completed" && trip.driverId) { const driver = drivers.find((item) => item.id === trip.driverId); if (driver) driver.status = "online"; trip.receiptNo = `EBM-2026-${Math.floor(10000 + Math.random() * 89999)}` } return trip }
export async function updatePayment(tripId: string, status: Trip["paymentStatus"]) { await delay(); const trip = trips.find((item) => item.id === tripId); if (!trip) throw new Error("Trip not found"); trip.paymentStatus = status; return trip }
export async function rateTrip(tripId: string, rating: number) { await delay(); const trip = trips.find((item) => item.id === tripId); if (!trip) throw new Error("Trip not found"); trip.riderRating = rating; return trip }
export async function getPartnerDetails(firmId: string) { await delay(); return firms.find((firm) => firm.id === firmId) }
export async function getTripAssignment(tripId: string) { await delay(); const trip = trips.find((item) => item.id === tripId); return trip ? { trip, driver: drivers.find((item) => item.id === trip.driverId), car: cars.find((item) => item.id === trip.carId), firm: firms.find((item) => item.id === trip.firmId) } : undefined }
