import { offerSeconds } from "./config"
import { companyInvoiceFor, feeInvoiceFor } from "./invoices"
import { fareSplit, quoteFare } from "./pricing"
import { addDays, kigaliDay, kigaliMonth, previousMonth } from "./time"
import type {
  AdminUser,
  Car,
  CommuteRoute,
  Company,
  CompanyInvoice,
  ComplianceDocument,
  Driver,
  DriverPresence,
  FeeInvoice,
  Firm,
  Incident,
  JobOffer,
  PaymentMethod,
  PlaceId,
  PlanName,
  PricingConfig,
  Rider,
  Trip,
  TripStatus,
  TripType,
} from "./types"

// Sample data for the demo. Only the mock data source (lib/data/mock.ts) reads this file.
// Names, phone numbers, TINs, licence numbers and merchant codes are made up.
// Dates are relative to the moment the seed is built, so the demo always looks current.
// Every fare comes from the fare engine; tests/seed.test.ts checks this.

export interface MockDb {
  version: number
  seededAt: string
  pilotStart: string
  firms: Firm[]
  companies: Company[]
  riders: Rider[]
  drivers: Driver[]
  cars: Car[]
  trips: Trip[]
  offers: JobOffer[]
  commuteRoutes: CommuteRoute[]
  feeInvoices: FeeInvoice[]
  companyInvoices: CompanyInvoice[]
  incidents: Incident[]
  pricing: PricingConfig
  admins: AdminUser[]
}

export const SEED_VERSION = 3
/** Days since the pilot started when the seed is built. Weeks 1 to 4 use Baseline, weeks 5 to 8 use Test. */
export const PILOT_DAY = 33
export const TEST_PLAN_FROM_DAY = 28

const MIN = 60_000

/** Kigali local time (UTC+2) on a given Kigali date, as a UTC Date. */
function kigaliAt(day: string, hour: number, minute = 0) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + ((hour - 2) * 60 + minute) * MIN)
}

function dayOffset(day: string, days: number) {
  return kigaliDay(addDays(new Date(`${day}T12:00:00Z`), days))
}

export function buildSeed(now: Date = new Date()): MockDb {
  const today = kigaliDay(now)
  const pilotStart = dayOffset(today, -PILOT_DAY)
  const inDays = (days: number) => dayOffset(today, days)

  const firms: Firm[] = [
    { id: "firm-1", name: "Kigali City Cabs Cooperative", type: "taxi", ruraLicenceNo: "RURA/TX/2025/0418", licenceExpiry: inDays(590), tin: "103847261", momoMerchantCode: "*182*8*1*482910#", airtelMerchantCode: "*500*4*2*482911#", feePercent: 12, status: "active" },
    { id: "firm-2", name: "Imena Mobility Rentals", type: "rental", ruraLicenceNo: "RURA/RN/2025/0281", licenceExpiry: inDays(450), tin: "109284735", momoMerchantCode: "*182*8*1*731640#", airtelMerchantCode: "*500*4*2*731641#", feePercent: 12, hourlyRate: 12000, dailyRate: 40000, status: "active" },
    { id: "firm-3", name: "Virunga Executive Cars", type: "rental", ruraLicenceNo: "RURA/RN/2026/0093", licenceExpiry: inDays(29), tin: "101736492", momoMerchantCode: "*182*8*1*622180#", airtelMerchantCode: "*500*4*2*622181#", feePercent: 12, hourlyRate: 15000, dailyRate: 55000, status: "pending_licence" },
  ]

  const companies: Company[] = [
    { id: "co-1", name: "Akagera Group", contactName: "Solange Mutesi", phone: "+250 788 600 101", staffCount: 86, status: "active", joinCode: "AKAGERA-24" },
    { id: "co-2", name: "Kivu Health Network", contactName: "Olivier Ndayisaba", phone: "+250 788 600 102", staffCount: 42, status: "active", joinCode: "KIVU-18" },
    { id: "co-3", name: "Imanzi Technologies", contactName: "Clarisse Umutoni", phone: "+250 788 600 103", staffCount: 28, status: "active", joinCode: "IMANZI-31" },
    { id: "co-4", name: "Rwanda Creative House", contactName: "Fabrice Mugisha", phone: "+250 788 600 104", staffCount: 19, status: "active", joinCode: "CREATIVE-07" },
  ]

  const riderNames = [
    "Aline Mukamana", "Eric Niyonzima", "Diane Uwase", "Patrick Habimana", "Jeanine Ingabire", "Yves Nshimiyimana",
    "Chantal Uwera", "Jean Bosco Hakizimana", "Grace Iradukunda", "Thierry Mugabo", "Sandrine Umuhire", "Kevin Ishimwe",
    "Vestine Nyiraneza", "Alain Rukundo", "Esther Mukeshimana", "Innocent Twagirayezu", "Liliane Uwamariya", "Emmanuel Gatete",
    "Josiane Mukandayisenga", "Pacifique Niyitegeka", "Beatrice Uwimana", "Fiston Irakoze", "Nadine Umubyeyi", "Claude Munyaneza",
    "Gloria Ingabire", "Didier Bizimungu", "Ange Mukarukundo", "Samuel Kamanzi", "Delphine Nyirahabimana", "Moses Habyarimana",
  ]
  const homes: PlaceId[] = ["kicukiro", "remera", "kimihurura", "kacyiru", "nyamirambo", "gisozi"]
  const works: PlaceId[] = ["kcc", "city-centre", "kacyiru", "remera"]
  const riders: Rider[] = riderNames.map((name, i) => ({
    id: `rider-${i + 1}`,
    name,
    phone: `+250 788 410 ${String(301 + i)}`,
    language: "en",
    // Riders 1 to 12 are staff of the four client companies, three each.
    companyId: i < 12 ? `co-${Math.floor(i / 3) + 1}` : undefined,
    savedPlaces: [
      { id: `sp-${i + 1}-home`, label: "Home", placeId: homes[i % homes.length] },
      { id: `sp-${i + 1}-work`, label: "Work", placeId: works[i % works.length] },
    ],
    emergencyContacts: i === 0 ? [{ id: "ec-1", name: "Jean Mukamana", phone: "+250 788 410 900" }] : [],
    consentAt: kigaliAt(pilotStart, 9).toISOString(),
    createdAt: kigaliAt(pilotStart, 9).toISOString(),
  }))

  const driverNames = [
    "Emmanuel Karemera", "Grace Uwamahoro", "David Nkurunziza", "Beatrice Mukamana", "Samuel Bizimana", "Claudine Nyirahabimana",
    "Joseph Ntwari", "Florence Mukashyaka", "Theogene Sibomana", "Agnes Uwizeye", "Robert Kayitare", "Marie Claire Umutesi",
  ]
  const zones: PlaceId[] = ["city-centre", "remera", "kimihurura", "kacyiru", "kicukiro", "nyabugogo", "kcc", "gisozi", "remera", "city-centre", "nyamirambo", "kicukiro"]
  const carModels = [
    { make: "Toyota", model: "Corolla", power: "fuel" as const },
    { make: "Hyundai", model: "Ioniq 5", power: "electric" as const },
    { make: "Volkswagen", model: "Passat", power: "fuel" as const },
    { make: "Nissan", model: "Leaf", power: "electric" as const },
    { make: "Toyota", model: "RAV4", power: "fuel" as const },
    { make: "Kia", model: "Niro EV", power: "electric" as const },
  ]
  const colours = ["Pearl white", "Midnight blue", "Silver", "Charcoal", "Red", "Black"]

  // Document exceptions so Ops alerts have something to show (days from today).
  const driverDocExceptions: Record<string, Partial<Record<string, { days?: number; review?: ComplianceDocument["review"] }>>> = {
    "driver-3": { professional_certificate: { days: 12 } },
    "driver-6": { criminal_record: { review: "missing" } },
    "driver-10": { driving_licence: { days: 20 } },
    "driver-11": { criminal_record: { review: "pending_review" } },
    "driver-12": { driving_licence: { days: -6 } },
  }
  const carDocExceptions: Record<string, Partial<Record<string, { days?: number; review?: ComplianceDocument["review"] }>>> = {
    "car-4": { inspection: { days: 9 } },
    "car-8": { insurance: { days: 25 } },
    "car-12": { inspection: { days: -3 } },
  }
  const doc = (owner: string, type: ComplianceDocument["type"], days: number | undefined, exceptions: typeof driverDocExceptions): ComplianceDocument => {
    const exception = exceptions[owner]?.[type]
    const expiryDays = exception?.days ?? days
    return { id: `${owner}-${type}`, type, expiryDate: expiryDays == null ? undefined : inDays(expiryDays), review: exception?.review ?? "on_file" }
  }

  const drivers: Driver[] = driverNames.map((name, i) => {
    const id = `driver-${i + 1}`
    return {
      id,
      firmId: i < 6 ? "firm-1" : "firm-2",
      name,
      phone: `+250 788 330 ${String(110 + i)}`,
      rating: [4.9, 4.8, 4.7, 4.9, 4.6, 4.8, 4.8, 4.9, 4.7, 4.8, 4.6, 4.5][i],
      status: "offline",
      approval: i === 5 ? "pending" : i === 11 ? "suspended" : "approved",
      zone: zones[i],
      carId: `car-${i + 1}`,
      documents: [
        doc(id, "driving_licence", 400 + i * 20, driverDocExceptions),
        doc(id, "national_id", undefined, driverDocExceptions),
        doc(id, "criminal_record", 150 + i * 5, driverDocExceptions),
        doc(id, "professional_certificate", 250 + i * 10, driverDocExceptions),
      ],
    }
  })

  const cars: Car[] = Array.from({ length: 12 }, (_, i) => {
    const id = `car-${i + 1}`
    const model = carModels[i % carModels.length]
    return {
      id,
      firmId: i < 6 ? "firm-1" : "firm-2",
      plate: `R${["AG", "AC", "AD", "AE"][i % 4]} ${String(120 + i * 37).padStart(3, "0")} ${String.fromCharCode(66 + i)}`,
      ...model,
      colour: colours[i % colours.length],
      year: 2020 + (i % 6),
      seats: 4,
      availability: i === 11 ? "out_of_service" : "available",
      zone: zones[i],
      documents: [doc(id, "registration", 500 + i * 15, carDocExceptions), doc(id, "inspection", 120 + i * 9, carDocExceptions), doc(id, "insurance", 200 + i * 11, carDocExceptions)],
    }
  })

  const commuteRoutes: CommuteRoute[] = [
    { id: "route-1", companyId: "co-1", name: "Remera to Kigali Convention Centre", stops: ["remera", "kimihurura", "kcc"], departureTimes: ["07:15", "17:30"], seatsPerCar: 3, riderIds: ["rider-1", "rider-2", "rider-3"] },
    { id: "route-2", companyId: "co-2", name: "Kicukiro to City Centre", stops: ["kicukiro", "remera", "city-centre"], departureTimes: ["07:00", "17:45"], seatsPerCar: 3, riderIds: ["rider-4", "rider-5", "rider-6"] },
  ]

  const plans = (active: PlanName): PricingConfig => ({
    plans: [
      { name: "Baseline", firstKm: 1500, perKm: 1000, sharedSeatPercent: 40, isActive: active === "Baseline" },
      { name: "Test", firstKm: 1200, perKm: 750, sharedSeatPercent: 40, isActive: active === "Test" },
    ],
    airportZones: [{ placeId: "city-centre", price: 12000 }, { placeId: "remera" }, { placeId: "kicukiro", price: 9000 }, { placeId: "kcc", price: 10000 }],
  })
  const planOn = (day: string): PlanName => (Date.parse(day) - Date.parse(pilotStart) >= TEST_PLAN_FROM_DAY * 86_400_000 ? "Test" : "Baseline")

  // Trip plan: [day offset from today, Kigali hour, minute, type, status, riderIndex, driverIndex?, pickup, dropoff, extra]
  type Spec = { day: number; hour: number; min?: number; type: TripType; status: TripStatus; rider: number; driver?: number; from: PlaceId; to: PlaceId; qty?: number; pay?: PaymentMethod; payState?: "paid" | "rider_paid" | "failed" | "pending"; route?: string; rating?: number; tags?: string[]; reason?: string }
  const specs: Spec[] = [
    // Weeks 1 to 4: Baseline prices
    { day: -33, hour: 7, type: "shared_commute", status: "completed", rider: 1, driver: 2, from: "remera", to: "kcc", route: "route-1", rating: 5 },
    { day: -32, hour: 8, type: "private", status: "completed", rider: 0, driver: 1, from: "kimihurura", to: "kcc", pay: "momo", rating: 5, tags: ["Friendly"] },
    { day: -31, hour: 9, type: "airport", status: "completed", rider: 13, driver: 3, from: "city-centre", to: "airport", pay: "airtel", rating: 4 },
    { day: -30, hour: 10, type: "hourly", status: "completed", rider: 14, driver: 7, from: "kacyiru", to: "kacyiru", qty: 3, pay: "momo", rating: 5 },
    { day: -29, hour: 17, type: "private", status: "cancelled_by_rider", rider: 15, from: "remera", to: "nyabugogo", pay: "momo", reason: "Plans changed" },
    { day: -28, hour: 12, type: "private", status: "completed", rider: 3, driver: 8, from: "kicukiro", to: "city-centre", pay: "company_account", rating: 5 },
    { day: -27, hour: 8, type: "daily", status: "completed", rider: 16, driver: 9, from: "kcc", to: "kcc", qty: 2, pay: "momo", rating: 5 },
    { day: -26, hour: 18, type: "private", status: "completed", rider: 17, driver: 4, from: "nyamirambo", to: "gisozi", pay: "airtel", payState: "failed" },
    { day: -24, hour: 7, type: "shared_commute", status: "completed", rider: 4, driver: 10, from: "kicukiro", to: "city-centre", route: "route-2", rating: 4 },
    { day: -22, hour: 14, type: "airport", status: "completed", rider: 18, driver: 1, from: "airport", to: "remera", pay: "momo", rating: 5 },
    { day: -20, hour: 9, type: "private", status: "no_driver_found", rider: 19, from: "gisozi", to: "kicukiro", pay: "momo" },
    { day: -18, hour: 16, type: "private", status: "completed", rider: 0, driver: 3, from: "kcc", to: "remera", pay: "airtel", rating: 4, tags: ["On time"] },
    { day: -16, hour: 11, type: "private", status: "cancelled_by_driver", rider: 20, driver: 2, from: "city-centre", to: "kimihurura", pay: "momo", reason: "Car breakdown" },
    { day: -13, hour: 8, type: "airport", status: "completed", rider: 21, driver: 8, from: "kicukiro", to: "airport", pay: "momo", rating: 5 },
    { day: -11, hour: 19, type: "private", status: "completed", rider: 6, driver: 4, from: "kacyiru", to: "nyamirambo", pay: "company_account", rating: 5 },
    { day: -9, hour: 7, type: "shared_commute", status: "completed", rider: 2, driver: 1, from: "remera", to: "kcc", route: "route-1", rating: 5 },
    { day: -8, hour: 13, type: "private", status: "completed", rider: 22, driver: 9, from: "nyabugogo", to: "kcc", pay: "airtel", rating: 4 },
    // Weeks 5 and 6: Test prices
    { day: -5, hour: 7, type: "shared_commute", status: "completed", rider: 5, driver: 7, from: "kicukiro", to: "city-centre", route: "route-2", rating: 5 },
    { day: -5, hour: 9, type: "private", status: "completed", rider: 0, driver: 2, from: "kimihurura", to: "city-centre", pay: "momo", rating: 5, tags: ["Smooth ride"] },
    { day: -4, hour: 15, type: "airport", status: "completed", rider: 23, driver: 10, from: "airport", to: "kcc", pay: "momo", rating: 5 },
    { day: -4, hour: 18, type: "private", status: "cancelled_by_rider", rider: 0, from: "kcc", to: "gisozi", pay: "airtel", reason: "Booked by mistake" },
    { day: -3, hour: 10, type: "hourly", status: "completed", rider: 24, driver: 8, from: "city-centre", to: "kcc", qty: 2, pay: "airtel", rating: 4 },
    { day: -3, hour: 12, type: "private", status: "completed", rider: 9, driver: 3, from: "kacyiru", to: "remera", pay: "company_account", rating: 5 },
    { day: -2, hour: 8, type: "daily", status: "completed", rider: 25, driver: 9, from: "remera", to: "remera", qty: 1, pay: "momo", rating: 5 },
    { day: -2, hour: 17, type: "private", status: "no_driver_found", rider: 26, from: "nyamirambo", to: "airport", pay: "momo" },
    { day: -1, hour: 7, type: "shared_commute", status: "completed", rider: 1, driver: 4, from: "remera", to: "kcc", route: "route-1", rating: 4 },
    { day: -1, hour: 14, type: "private", status: "completed", rider: 27, driver: 1, from: "gisozi", to: "nyabugogo", pay: "momo", rating: 5 },
    { day: -1, hour: 20, type: "airport", status: "completed", rider: 28, driver: 7, from: "remera", to: "airport", pay: "airtel", rating: 5 },
    // Today
    { day: 0, hour: 6, min: 40, type: "private", status: "completed", rider: 29, driver: 2, from: "kicukiro", to: "kcc", pay: "momo", rating: 5 },
    { day: 0, hour: 7, min: 5, type: "shared_commute", status: "completed", rider: 3, driver: 10, from: "kicukiro", to: "city-centre", route: "route-2" },
    { day: 0, hour: 7, min: 30, type: "private", status: "completed", rider: 12, driver: 8, from: "remera", to: "kacyiru", pay: "airtel", payState: "rider_paid" },
    { day: 0, hour: 8, min: 10, type: "private", status: "in_progress", rider: 13, driver: 5, from: "city-centre", to: "kimihurura", pay: "momo" },
    { day: 0, hour: 8, min: 20, type: "airport", status: "in_progress", rider: 14, driver: 9, from: "kcc", to: "airport", pay: "airtel" },
    { day: 0, hour: 8, min: 35, type: "private", status: "driver_arrived", rider: 15, driver: 3, from: "nyabugogo", to: "gisozi", pay: "momo" },
    { day: 0, hour: 8, min: 40, type: "hourly", status: "driver_arriving", rider: 16, driver: 7, from: "kacyiru", to: "kacyiru", qty: 2, pay: "momo" },
    { day: 0, hour: 8, min: 45, type: "private", status: "assigned", rider: 17, driver: 1, from: "remera", to: "city-centre", pay: "airtel" },
    { day: 0, hour: 8, min: 50, type: "private", status: "requested", rider: 18, from: "kimihurura", to: "nyamirambo", pay: "momo" },
    { day: 0, hour: 8, min: 55, type: "airport", status: "requested", rider: 7, from: "airport", to: "kicukiro", pay: "company_account" },
    { day: 0, hour: 9, type: "daily", status: "scheduled", rider: 19, from: "city-centre", to: "city-centre", qty: 1, pay: "momo" },
    { day: 0, hour: 9, min: 5, type: "private", status: "scheduled", rider: 10, from: "kacyiru", to: "airport", pay: "company_account" },
  ]

  const tripStatusesWithDriver: TripStatus[] = ["assigned", "driver_arriving", "driver_arrived", "in_progress", "completed", "cancelled_by_driver"]
  const hireFirm = firms[1]
  let receiptSeq = 0
  const trips: Trip[] = specs.map((spec, i) => {
    const day = inDays(spec.day)
    const planName = planOn(day)
    const config = plans(planName)
    const rider = riders[spec.rider]
    const driver = spec.driver ? drivers[spec.driver - 1] : undefined
    const isHire = spec.type === "hourly" || spec.type === "daily"
    const firm = driver ? firms.find((item) => item.id === driver.firmId)! : isHire ? hireFirm : firms[i % 2]
    if (isHire && firm.id !== hireFirm.id) throw new Error(`Seed trip ${i}: hire must use a firm with hire rates`)
    const quote = quoteFare({ type: spec.type, pickup: spec.from, dropoff: spec.to, hireQuantity: spec.qty, firm }, config)
    const paymentMethod: PaymentMethod = spec.type === "shared_commute" ? "company_account" : spec.pay ?? "momo"
    if (paymentMethod === "company_account" && !rider.companyId) throw new Error(`Seed trip ${i}: company billing needs a company rider`)
    const created = kigaliAt(day, spec.hour, spec.min ?? 0)
    const at = (minutes: number) => new Date(created.getTime() + minutes * MIN).toISOString()
    const rideMinutes = spec.type === "hourly" ? (spec.qty ?? 1) * 60 : spec.type === "daily" ? (spec.qty ?? 1) * 600 : Math.ceil(quote.distanceKm * 2.5) + 4
    const reached = (status: TripStatus) => {
      const order: TripStatus[] = ["assigned", "driver_arriving", "driver_arrived", "in_progress", "completed"]
      return order.indexOf(spec.status) >= order.indexOf(status)
    }
    const completed = spec.status === "completed"
    const cancelled = spec.status === "cancelled_by_rider" || spec.status === "cancelled_by_driver" || spec.status === "no_driver_found"
    const scheduledFor = spec.status === "scheduled" ? kigaliAt(inDays(1), spec.hour - 1).toISOString() : undefined
    const paymentStatus: Trip["paymentStatus"] =
      paymentMethod === "company_account" ? "billed_to_company" : completed ? (spec.payState === "failed" ? "failed" : spec.payState === "rider_paid" ? "pending" : "paid") : "pending"
    const completedAt = completed ? at(10 + rideMinutes) : undefined
    const trip: Trip = {
      id: `FLT-${2400 + i}`,
      type: spec.type,
      riderId: rider.id,
      companyId: paymentMethod === "company_account" ? rider.companyId : undefined,
      firmId: firm.id,
      driverId: driver && tripStatusesWithDriver.includes(spec.status) ? driver.id : undefined,
      carId: driver && tripStatusesWithDriver.includes(spec.status) ? driver.carId : undefined,
      pickup: spec.from,
      dropoff: spec.to,
      distanceKm: quote.distanceKm,
      hireQuantity: isHire ? spec.qty ?? 1 : undefined,
      scheduledFor,
      fare: quote.fare,
      platformFee: fareSplit(quote.fare, firm.feePercent).platformFee,
      planName,
      status: spec.status,
      paymentMethod,
      paymentStatus,
      receiptNo: completed ? `EBM-${day.slice(0, 4)}-${String(10001 + receiptSeq++).padStart(5, "0")}` : undefined,
      riderRating: completed ? spec.rating : undefined,
      ratingTags: completed && spec.tags ? spec.tags : undefined,
      driverRating: completed ? 5 : undefined,
      cancelReason: spec.status === "no_driver_found" ? "No driver accepted" : spec.reason,
      cancelledBy: spec.status === "cancelled_by_rider" ? "rider" : spec.status === "cancelled_by_driver" ? "driver" : spec.status === "no_driver_found" ? "system" : undefined,
      commuteRouteId: spec.route,
      createdAt: created.toISOString(),
      updatedAt: completedAt ?? (cancelled ? at(spec.status === "cancelled_by_driver" ? 6 : 4) : at(reached("in_progress") ? 10 : reached("driver_arrived") ? 9 : reached("driver_arriving") ? 3 : reached("assigned") ? 2 : 0)),
      assignedAt: reached("assigned") || spec.status === "cancelled_by_driver" ? at(2) : undefined,
      acceptedAt: reached("driver_arriving") || spec.status === "cancelled_by_driver" ? at(3) : undefined,
      arrivedAt: reached("driver_arrived") ? at(9) : undefined,
      startedAt: reached("in_progress") ? at(10) : undefined,
      completedAt,
      cancelledAt: cancelled ? at(spec.status === "cancelled_by_driver" ? 6 : 4) : undefined,
      riderPaidAt: completed && paymentMethod !== "company_account" && spec.payState !== "failed" ? at(12 + rideMinutes) : undefined,
      paidAt: paymentStatus === "paid" ? at(14 + rideMinutes) : undefined,
    }
    return trip
  })

  // Driver presence and car availability follow the active trips.
  const busy = new Set(trips.filter((trip) => ["assigned", "driver_arriving", "driver_arrived", "in_progress"].includes(trip.status)).map((trip) => trip.driverId))
  const online = new Set(["driver-2", "driver-4", "driver-8", "driver-10"])
  for (const driver of drivers) {
    const presence: DriverPresence = busy.has(driver.id) ? "on_trip" : online.has(driver.id) ? "online" : "offline"
    driver.status = presence
    const car = cars.find((item) => item.id === driver.carId)
    if (car && presence === "on_trip") car.availability = "in_use"
  }

  // The assigned trip has its 20-second job offer open from the moment the demo data is built.
  // If nobody accepts it in time, it expires and the trip goes back to the Dispatch queue (rule a).
  const offers: JobOffer[] = trips
    .filter((trip) => trip.status === "assigned" && trip.driverId)
    .map((trip) => ({ id: `offer-seed-${trip.id}`, tripId: trip.id, driverId: trip.driverId!, status: "pending", createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + offerSeconds * 1000).toISOString() }))

  const lastMonth = previousMonth(kigaliMonth(now))
  const feeInvoices: FeeInvoice[] = firms
    .filter((firm) => firm.status === "active")
    .map((firm, i) => ({ id: `FI-${lastMonth}-${i + 1}`, ...feeInvoiceFor(firm, trips, lastMonth), status: i === 0 ? "paid" : "sent" }))
  const companyInvoices: CompanyInvoice[] = companies.map((company, i) => ({ id: `CI-${lastMonth}-${i + 1}`, ...companyInvoiceFor(company.id, trips, lastMonth), status: i === 0 ? "paid" : "sent" }))

  const incidents: Incident[] = [
    { id: "INC-301", tripId: trips[7].id, type: "complaint", description: "Rider says the MoMo payment failed twice at drop-off.", status: "investigating", notes: ["Called the firm; checking the merchant account."], reportedBy: "rider", createdAt: trips[7].completedAt ?? trips[7].createdAt },
    { id: "INC-302", tripId: trips[31].id, type: "safety", description: "Rider pressed SOS and asked for an operations check-in.", status: "open", notes: [], reportedBy: "rider", createdAt: trips[31].startedAt ?? trips[31].createdAt },
    { id: "INC-303", type: "damage", description: "Minor door mark noted after inspection of RAC 157 C.", status: "closed", notes: ["Firm confirmed it was there before the pilot."], reportedBy: "ops", createdAt: kigaliAt(inDays(-12), 15).toISOString() },
  ]

  const admins: AdminUser[] = [
    { id: "admin-1", name: "Ange Uwimana", phone: "+250 788 200 001", role: "platform_admin" },
    { id: "admin-2", name: "Jean Paul Mugenzi", phone: "+250 788 200 002", role: "firm_admin", firmId: "firm-1" },
    { id: "admin-3", name: "Odette Nyiransabimana", phone: "+250 788 200 003", role: "firm_admin", firmId: "firm-2" },
    { id: "admin-4", name: "Solange Mutesi", phone: "+250 788 600 101", role: "company_admin", companyId: "co-1" },
    { id: "admin-5", name: "Olivier Ndayisaba", phone: "+250 788 600 102", role: "company_admin", companyId: "co-2" },
  ]

  return {
    version: SEED_VERSION,
    seededAt: now.toISOString(),
    pilotStart,
    firms,
    companies,
    riders,
    drivers,
    cars,
    trips,
    offers,
    commuteRoutes,
    feeInvoices,
    companyInvoices,
    incidents,
    pricing: plans(planOn(today)),
    admins,
  }
}
