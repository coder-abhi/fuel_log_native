/**
 * Estimated remaining fuel & range.
 *
 * Recomputed whenever a fuel entry or odometer check-in is saved. In v1 the
 * low-fuel notification is NOT wired up, but the same numbers are shown as two
 * stat cards on the dashboard, and `atOrBelowReserve` is returned so the
 * notification can be added later without touching this logic.
 *
 * Approach (per spec — deliberately "best effort"):
 *  1. currentOdometer = the latest odometer reading across fuel entries +
 *     odometer check-ins (by timestamp).
 *  2. Baseline = the most recent FULL-TANK fuel entry. If none exists we cannot
 *     estimate — return canEstimate:false, reason 'no-full-tank'.
 *  3. mileage = since-last-service km/l (more responsive than lifetime). Before
 *     any usable interval exists it falls back to a rough per-vehicle-type
 *     average (see roughMileageForType) so the estimate still works early on;
 *     `mileageUsed` stays null in that case so the rough number is never shown.
 *  4. kmSinceFull       = max(0, currentOdometer - baseline.odometerKm)
 *     litresAddedSince   = sum of litresFilled for fuel entries strictly after
 *                          the baseline (these are partial top-ups)
 *  5. estimatedFuel = tankCapacity - (kmSinceFull / mileage) + litresAddedSince
 *  6. remainingLitres = clamp(estimatedFuel, 0, tankCapacity)
 *  7. estimatedRangeKm = remainingLitres * mileage
 *  8. atOrBelowReserve = remainingLitres <= vehicle.reserveThresholdLitres
 */

import { sinceLastServiceMileage } from './mileage';
import type {
  FuelEntry,
  OdometerCheckin,
  ServiceRecord,
  Vehicle,
  VehicleType,
} from './types';

/**
 * Rough real-world mileage (km/l) by vehicle class. Ballpark Indian averages,
 * hard-coded because the app is fully offline. This is ONLY a bootstrap so the
 * fuel / range estimate has something to work with before enough fills exist to
 * compute a real figure — it is never surfaced in the UI, and `mileageUsed`
 * stays null whenever this fallback is in play.
 */
const ROUGH_MILEAGE_KMPL: Record<VehicleType, number> = {
  bike: 35,
  scooty: 40,
  car: 15,
};

export function roughMileageForType(type: VehicleType): number {
  return ROUGH_MILEAGE_KMPL[type] ?? ROUGH_MILEAGE_KMPL.bike;
}

export interface RemainingFuelResult {
  canEstimate: boolean;
  reason: 'ok' | 'no-full-tank' | 'no-mileage' | 'no-readings';
  remainingLitres: number | null;
  estimatedRangeKm: number | null;
  atOrBelowReserve: boolean;
  /** mileage figure used for the estimate (km/l), for display / debugging. */
  mileageUsed: number | null;
  /** odometer reading the estimate was anchored to. */
  currentOdometerKm: number | null;
  /** odometer of the full-tank baseline entry. */
  baselineOdometerKm: number | null;
}

const EMPTY: RemainingFuelResult = {
  canEstimate: false,
  reason: 'no-readings',
  remainingLitres: null,
  estimatedRangeKm: null,
  atOrBelowReserve: false,
  mileageUsed: null,
  currentOdometerKm: null,
  baselineOdometerKm: null,
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Latest odometer reading across both timelines, chosen by timestamp. */
export function currentOdometer(
  fuelEntries: readonly FuelEntry[],
  odometerCheckins: readonly OdometerCheckin[],
): { odometerKm: number; at: string } | null {
  let best: { odometerKm: number; at: string } | null = null;
  const consider = (odometerKm: number, at: string) => {
    if (!best || Date.parse(at) > Date.parse(best.at)) {
      best = { odometerKm, at };
    }
  };
  for (const f of fuelEntries) consider(f.odometerKm, f.filledAt);
  for (const c of odometerCheckins) consider(c.odometerKm, c.checkedAt);
  return best;
}

/** Most recent full-tank fuel entry (by filledAt), or null. */
export function latestFullTank(fuelEntries: readonly FuelEntry[]): FuelEntry | null {
  let best: FuelEntry | null = null;
  for (const f of fuelEntries) {
    if (!f.isFullTank) continue;
    if (!best || Date.parse(f.filledAt) > Date.parse(best.filledAt)) best = f;
  }
  return best;
}

export function estimateRemainingFuel(params: {
  vehicle: Vehicle;
  fuelEntries: readonly FuelEntry[];
  odometerCheckins: readonly OdometerCheckin[];
  services: readonly ServiceRecord[];
}): RemainingFuelResult {
  const { vehicle, fuelEntries, odometerCheckins, services } = params;

  const current = currentOdometer(fuelEntries, odometerCheckins);
  if (!current) return { ...EMPTY, reason: 'no-readings' };

  const baseline = latestFullTank(fuelEntries);
  if (!baseline) {
    return {
      ...EMPTY,
      reason: 'no-full-tank',
      currentOdometerKm: current.odometerKm,
    };
  }

  // Prefer the figure computed from real fills; before that exists, fall back to
  // a rough per-type average so the estimate still works in the first few days.
  const calcMileage = sinceLastServiceMileage(fuelEntries, services).kmPerLitre;
  const usingCalcMileage = calcMileage !== null && calcMileage > 0;
  const mileage = usingCalcMileage ? calcMileage : roughMileageForType(vehicle.type);

  const kmSinceFull = Math.max(0, current.odometerKm - baseline.odometerKm);

  const baselineTime = Date.parse(baseline.filledAt);
  let litresAddedSince = 0;
  for (const f of fuelEntries) {
    if (Date.parse(f.filledAt) > baselineTime) {
      litresAddedSince += f.litresFilled ?? 0;
    }
  }

  const estimatedFuel =
    vehicle.tankCapacityLitres - kmSinceFull / mileage + litresAddedSince;
  const remainingLitres = clamp(estimatedFuel, 0, vehicle.tankCapacityLitres);
  const estimatedRangeKm = remainingLitres * mileage;

  return {
    canEstimate: true,
    reason: 'ok',
    remainingLitres,
    estimatedRangeKm,
    atOrBelowReserve: remainingLitres <= vehicle.reserveThresholdLitres,
    // Only report a mileage figure that came from the user's own fills.
    mileageUsed: usingCalcMileage ? mileage : null,
    currentOdometerKm: current.odometerKm,
    baselineOdometerKm: baseline.odometerKm,
  };
}
