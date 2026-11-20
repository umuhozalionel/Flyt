import { dataSource } from "./config"
import { mockSource } from "./data/mock"
import { supabaseSource } from "./data/supabase"
import type { DataSource } from "./data/types"

// The only data door for screens. It forwards every call to the data source picked by
// NEXT_PUBLIC_DATA_SOURCE (mock by default). Screens never import mock data or Supabase directly.
const source: DataSource = dataSource === "supabase" ? supabaseSource : mockSource

export type { AdminPortal, BonusTargetInput, SendChatInput, TipSettingsInput, BookingInput, SignInCodeResult, DocumentExpiries, DocumentReviewInput, DriverJob, FareCorrectionInput, FirmRates, InvoiceRun, NewAdminInput, NewCarInput, NewCompanyInput, NewDriverInput, NewFirmInput, NewStaffInput, QuoteInput, RideQuote, RiderProfileUpdate, Topic, TripAssignment } from "./data/types"

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

export const requestSignInCode: DataSource["requestSignInCode"] = (phone) => source.requestSignInCode(phone)
export const signInAdmin: DataSource["signInAdmin"] = (input) => source.signInAdmin(input)
export const getSignedInAdmins: DataSource["getSignedInAdmins"] = (portal) => source.getSignedInAdmins(portal)
export const devSignIn = (email: string, password: string) => (source.devSignIn ? source.devSignIn(email, password) : Promise.reject(new Error("Dev sign-in is off")))
export const signOut = () => source.signOut()
export const getDocumentFileUrl: DataSource["getDocumentFileUrl"] = (owner, ownerId, type) => source.getDocumentFileUrl(owner, ownerId, type)
export const signInRider: DataSource["signInRider"] = (input) => source.signInRider(input)
export const updateRider: DataSource["updateRider"] = (riderId, update) => source.updateRider(riderId, update)

export const quoteTrip: DataSource["quoteTrip"] = (input) => source.quoteTrip(input)
export const getPickupEtas: DataSource["getPickupEtas"] = (pickup, types) => source.getPickupEtas(pickup, types)
export const createBooking: DataSource["createBooking"] = (input) => source.createBooking(input)
export const assignDriver: DataSource["assignDriver"] = (tripId, driverId, byAdminId) => source.assignDriver(tripId, driverId, byAdminId)
export const reassignDriver: DataSource["reassignDriver"] = (tripId, driverId, byAdminId) => source.reassignDriver(tripId, driverId, byAdminId)
export const respondOffer: DataSource["respondOffer"] = (offerId, accept) => source.respondOffer(offerId, accept)
export const driverArrived: DataSource["driverArrived"] = (tripId) => source.driverArrived(tripId)
export const startTrip: DataSource["startTrip"] = (tripId, pin) => source.startTrip(tripId, pin)
export const endTrip: DataSource["endTrip"] = (tripId) => source.endTrip(tripId)
export const cancelTrip: DataSource["cancelTrip"] = (tripId, by, reason) => source.cancelTrip(tripId, by, reason)
export const markNoDriverFound: DataSource["markNoDriverFound"] = (tripId) => source.markNoDriverFound(tripId)

export const riderMarkPaid: DataSource["riderMarkPaid"] = (tripId) => source.riderMarkPaid(tripId)
export const confirmPayment: DataSource["confirmPayment"] = (tripId, received) => source.confirmPayment(tripId, received)
export const rateTrip: DataSource["rateTrip"] = (tripId, rating, tags, comment) => source.rateTrip(tripId, rating, tags, comment)
export const rateRider: DataSource["rateRider"] = (tripId, rating) => source.rateRider(tripId, rating)

export const addFirm: DataSource["addFirm"] = (input) => source.addFirm(input)
export const addDriver: DataSource["addDriver"] = (input) => source.addDriver(input)
export const addCar: DataSource["addCar"] = (input) => source.addCar(input)
export const setDriverApproval: DataSource["setDriverApproval"] = (driverId, approval) => source.setDriverApproval(driverId, approval)
export const reviewDocument: DataSource["reviewDocument"] = (input) => source.reviewDocument(input)

export const addCompany: DataSource["addCompany"] = (input) => source.addCompany(input)
export const addStaff: DataSource["addStaff"] = (companyId, input) => source.addStaff(companyId, input)
export const removeStaff: DataSource["removeStaff"] = (companyId, riderId) => source.removeStaff(companyId, riderId)

export const generateInvoices: DataSource["generateInvoices"] = (period) => source.generateInvoices(period)
export const setInvoiceStatus: DataSource["setInvoiceStatus"] = (kind, invoiceId, status) => source.setInvoiceStatus(kind, invoiceId, status)

export const addAdmin: DataSource["addAdmin"] = (input) => source.addAdmin(input)
export const removeAdmin: DataSource["removeAdmin"] = (adminId, byAdminId) => source.removeAdmin(adminId, byAdminId)

export const signInDriver: DataSource["signInDriver"] = (input) => source.signInDriver(input)
export const getDriverTrips: DataSource["getDriverTrips"] = (driverId) => source.getDriverTrips(driverId)
export const getDriverJob: DataSource["getDriverJob"] = (tripId, driverId) => source.getDriverJob(tripId, driverId)
export const submitDocument: DataSource["submitDocument"] = (driverId, type, expiryDate, file) => source.submitDocument(driverId, type, expiryDate, file)
export const setDriverPresence: DataSource["setDriverPresence"] = (driverId, presence) => source.setDriverPresence(driverId, presence)

export const setActivePlan: DataSource["setActivePlan"] = (name) => source.setActivePlan(name)
export const updatePlan: DataSource["updatePlan"] = (name, values) => source.updatePlan(name, values)
export const updateAirportZones: DataSource["updateAirportZones"] = (zones) => source.updateAirportZones(zones)
export const setFirmFee: DataSource["setFirmFee"] = (firmId, feePercent) => source.setFirmFee(firmId, feePercent)
export const correctTripFare: DataSource["correctTripFare"] = (input) => source.correctTripFare(input)
export const setFirmRates: DataSource["setFirmRates"] = (firmId, rates) => source.setFirmRates(firmId, rates)

export const reportIncident: DataSource["reportIncident"] = (input) => source.reportIncident(input)
export const updateIncident: DataSource["updateIncident"] = (incidentId, update) => source.updateIncident(incidentId, update)

// Phase 6B additions
export const getNotifications: DataSource["getNotifications"] = (viewer) => source.getNotifications(viewer)
export const markNotificationsRead: DataSource["markNotificationsRead"] = (viewer, ids) => source.markNotificationsRead(viewer, ids)
export const getNotificationMutes: DataSource["getNotificationMutes"] = (viewer) => source.getNotificationMutes(viewer)
export const setNotificationMute: DataSource["setNotificationMute"] = (viewer, type, muted) => source.setNotificationMute(viewer, type, muted)
export const savePushSubscription: DataSource["savePushSubscription"] = (viewer, subscription) => source.savePushSubscription(viewer, subscription)
export const deletePushSubscription: DataSource["deletePushSubscription"] = (endpoint) => source.deletePushSubscription(endpoint)
export const getTripPin: DataSource["getTripPin"] = (tripId) => source.getTripPin(tripId)
export const getChat: DataSource["getChat"] = (tripId, channel) => source.getChat(tripId, channel)
export const sendChat: DataSource["sendChat"] = (input) => source.sendChat(input)
export const getFavouriteDrivers: DataSource["getFavouriteDrivers"] = (riderId) => source.getFavouriteDrivers(riderId)
export const setFavouriteDriver: DataSource["setFavouriteDriver"] = (riderId, driverId, favourite) => source.setFavouriteDriver(riderId, driverId, favourite)
export const getDriverPreferences: DataSource["getDriverPreferences"] = () => source.getDriverPreferences()
export const setDriverPreferences: DataSource["setDriverPreferences"] = (driverId, preferences) => source.setDriverPreferences(driverId, preferences)
export const getBusyAreas: DataSource["getBusyAreas"] = () => source.getBusyAreas()
export const getFreeCars: DataSource["getFreeCars"] = () => source.getFreeCars()
export const createTripShare: DataSource["createTripShare"] = (tripId) => source.createTripShare(tripId)
export const revokeTripShares: DataSource["revokeTripShares"] = (tripId) => source.revokeTripShares(tripId)
export const getSharedTrip: DataSource["getSharedTrip"] = (token) => source.getSharedTrip(token)
export const getLostItems: DataSource["getLostItems"] = () => source.getLostItems()
export const reportLostItem: DataSource["reportLostItem"] = (tripId, description) => source.reportLostItem(tripId, description)
export const updateLostItem: DataSource["updateLostItem"] = (itemId, status) => source.updateLostItem(itemId, status)
export const getSettings: DataSource["getSettings"] = () => source.getSettings()
export const setSetting: DataSource["setSetting"] = (key, value) => source.setSetting(key, value)
export const getBonusTargets: DataSource["getBonusTargets"] = () => source.getBonusTargets()
export const saveBonusTarget: DataSource["saveBonusTarget"] = (input) => source.saveBonusTarget(input)
export const getBonusProgress: DataSource["getBonusProgress"] = (driverId) => source.getBonusProgress(driverId)
export const getRewardPoints: DataSource["getRewardPoints"] = (riderId) => source.getRewardPoints(riderId)
export const getTipDetails: DataSource["getTipDetails"] = (tripId) => source.getTipDetails(tripId)
export const recordTip: DataSource["recordTip"] = (tripId, amount) => source.recordTip(tripId, amount)
export const getTips: DataSource["getTips"] = () => source.getTips()
export const setFirmTips: DataSource["setFirmTips"] = (firmId, enabled) => source.setFirmTips(firmId, enabled)
export const setTipSettings: DataSource["setTipSettings"] = (driverId, input) => source.setTipSettings(driverId, input)

export const resetDemo = () => source.resetDemo?.() ?? Promise.resolve()
export const isDemoData = dataSource === "mock"
