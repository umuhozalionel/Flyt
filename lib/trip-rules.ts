import type { TripStatus } from "./types"

// Allowed trip status moves. The Postgres RPC functions enforce the same table.
export const tripTransitions: Record<TripStatus, TripStatus[]> = {
  requested: ["assigned", "cancelled_by_rider", "no_driver_found"],
  scheduled: ["assigned", "cancelled_by_rider", "no_driver_found"],
  // A declined or expired offer sends the trip back to requested (the Dispatch queue).
  assigned: ["driver_arriving", "requested", "cancelled_by_rider", "cancelled_by_driver"],
  driver_arriving: ["driver_arrived", "cancelled_by_rider", "cancelled_by_driver"],
  driver_arrived: ["in_progress", "cancelled_by_rider", "cancelled_by_driver"],
  in_progress: ["completed"],
  completed: [],
  cancelled_by_rider: [],
  cancelled_by_driver: [],
  no_driver_found: [],
}

/** Statuses from which Ops can move a trip to another driver. */
export const reassignableStatuses: TripStatus[] = ["assigned", "driver_arriving"]
/** Waiting for a driver: shown in the Dispatch queue. */
export const waitingStatuses: TripStatus[] = ["requested", "scheduled"]
/** A driver is attached and the trip has not ended. */
export const activeStatuses: TripStatus[] = ["assigned", "driver_arriving", "driver_arrived", "in_progress"]
export const finishedStatuses: TripStatus[] = ["completed", "cancelled_by_rider", "cancelled_by_driver", "no_driver_found"]
export const cancelledStatuses: TripStatus[] = ["cancelled_by_rider", "cancelled_by_driver", "no_driver_found"]

export function canMove(from: TripStatus, to: TripStatus) {
  return tripTransitions[from].includes(to)
}

export class TransitionError extends Error {
  constructor(from: TripStatus, to: TripStatus) {
    super(`A trip cannot move from ${from} to ${to}`)
  }
}

export function assertMove(from: TripStatus, to: TripStatus) {
  if (!canMove(from, to)) throw new TransitionError(from, to)
}
