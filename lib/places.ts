import type { Place, PlaceDistance, PlaceId } from "./types"

// Reference data: the 10 Kigali places used in version 1, and road distances between them.
// The same rows are seeded into the places and place_distances tables.
export const places: Place[] = [
  { id: "kicukiro", name: "Kicukiro", lat: -1.9706, lng: 30.1044 },
  { id: "remera", name: "Remera", lat: -1.9578, lng: 30.1127 },
  { id: "kimihurura", name: "Kimihurura", lat: -1.9530, lng: 30.0920 },
  { id: "kacyiru", name: "Kacyiru", lat: -1.9380, lng: 30.0870 },
  { id: "nyamirambo", name: "Nyamirambo", lat: -1.9800, lng: 30.0440 },
  { id: "gisozi", name: "Gisozi", lat: -1.9200, lng: 30.0700 },
  { id: "nyabugogo", name: "Nyabugogo", lat: -1.9370, lng: 30.0450 },
  { id: "city-centre", name: "City Centre", lat: -1.9441, lng: 30.0619 },
  { id: "kcc", name: "Kigali Convention Centre", lat: -1.9545, lng: 30.0930 },
  { id: "airport", name: "Kigali International Airport", lat: -1.9686, lng: 30.1395 },
]

export const placeIds = places.map((place) => place.id)

// Approximate road distances in km, one row per pair (the table works both ways).
export const placeDistances: PlaceDistance[] = [
  { from: "city-centre", to: "kicukiro", km: 7.5 },
  { from: "city-centre", to: "remera", km: 7 },
  { from: "city-centre", to: "kimihurura", km: 4 },
  { from: "city-centre", to: "kacyiru", km: 4.5 },
  { from: "city-centre", to: "nyamirambo", km: 4 },
  { from: "city-centre", to: "gisozi", km: 6 },
  { from: "city-centre", to: "nyabugogo", km: 3.5 },
  { from: "city-centre", to: "kcc", km: 4.5 },
  { from: "city-centre", to: "airport", km: 10.5 },
  { from: "kcc", to: "kicukiro", km: 5.5 },
  { from: "kcc", to: "remera", km: 3 },
  { from: "kcc", to: "kimihurura", km: 1.5 },
  { from: "kcc", to: "kacyiru", km: 3.5 },
  { from: "kcc", to: "nyamirambo", km: 8 },
  { from: "kcc", to: "gisozi", km: 8 },
  { from: "kcc", to: "nyabugogo", km: 7.5 },
  { from: "kcc", to: "airport", km: 7 },
  { from: "kimihurura", to: "kicukiro", km: 6 },
  { from: "kimihurura", to: "remera", km: 3.5 },
  { from: "kimihurura", to: "kacyiru", km: 3 },
  { from: "kimihurura", to: "nyamirambo", km: 7.5 },
  { from: "kimihurura", to: "gisozi", km: 7 },
  { from: "kimihurura", to: "nyabugogo", km: 7 },
  { from: "kimihurura", to: "airport", km: 8 },
  { from: "remera", to: "kicukiro", km: 5 },
  { from: "remera", to: "kacyiru", km: 5 },
  { from: "remera", to: "nyamirambo", km: 10.5 },
  { from: "remera", to: "gisozi", km: 8.5 },
  { from: "remera", to: "nyabugogo", km: 10 },
  { from: "remera", to: "airport", km: 5 },
  { from: "kicukiro", to: "kacyiru", km: 8.5 },
  { from: "kicukiro", to: "nyamirambo", km: 9 },
  { from: "kicukiro", to: "gisozi", km: 12.5 },
  { from: "kicukiro", to: "nyabugogo", km: 10.5 },
  { from: "kicukiro", to: "airport", km: 6.5 },
  { from: "kacyiru", to: "nyamirambo", km: 8 },
  { from: "kacyiru", to: "gisozi", km: 4.5 },
  { from: "kacyiru", to: "nyabugogo", km: 6 },
  { from: "kacyiru", to: "airport", km: 9.5 },
  { from: "nyamirambo", to: "gisozi", km: 9 },
  { from: "nyamirambo", to: "nyabugogo", km: 4.5 },
  { from: "nyamirambo", to: "airport", km: 14.5 },
  { from: "gisozi", to: "nyabugogo", km: 4 },
  { from: "gisozi", to: "airport", km: 13 },
  { from: "nyabugogo", to: "airport", km: 13.5 },
]

export function placeName(id: PlaceId | string | undefined) {
  return places.find((place) => place.id === id)?.name ?? String(id ?? "")
}

export function isPlaceId(value: string): value is PlaceId {
  return placeIds.includes(value as PlaceId)
}

/** Road distance in km between two places. Throws for unknown or identical places. */
export function distanceBetween(from: PlaceId, to: PlaceId) {
  if (from === to) throw new Error("Pickup and drop-off must be different places")
  const row = placeDistances.find((item) => (item.from === from && item.to === to) || (item.from === to && item.to === from))
  if (!row) throw new Error(`No distance for ${from} to ${to}`)
  return row.km
}
