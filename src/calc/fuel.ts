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
 *  7. Reconciliation: if the CURRENT reading is an odometer check-in where the
 *     user also logged a rough tank-level guess (the fuel-level slider), that
 *     is an independent, physically-observed estimate of the same quantity —
 *     showing the pure fill-based number next to it would just contradict the
 *     user's own eyes. Neither figure is exact, so split the difference:
 *       remainingLitres = (calcRemainingLitres + observedRemainingLitres) / 2
 *     Because the calc side runs off "distance / mileage", believing there is
 *     LESS fuel left than the math predicted implies MORE fuel was actually
 *     burned to cover the same distance — so the mileage used for the range
 *     projection is re-derived from the reconciled figure rather than left
 *     contradicting it:
 *       litresConsumedSinceFull = tankCapacity - remainingLitres + litresAddedSince
 *       effectiveMileage        = kmSinceFull / litresConsumedSinceFull
 *  8. estimatedRangeKm = remainingLitres * effectiveMileage
 *  9. atOrBelowReserve = remainingLitres <= vehicle.reserveThresholdLitres
 *
 * `litresConsumedSinceBaseline` (tankCapacity - remainingLitres +
 * litresAddedSince) is exposed on the result and reused by
 * `fuelBalance.ts`'s Lifetime / Since-last-service calculation to close its
 * own still-open segment, so the two figures stay consistent.
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
  /**
   * Mileage figure used for the range projection (km/l), for display / debugging.
   * Null when there isn't yet a real fill-based figure to show (the rough
   * per-type average is used internally but never surfaced). When a fuel-level
   * check-in reconciles against the calculated remaining fuel, this reflects
   * the reconciled figure rather than the raw fill-based one.
   */
  mileageUsed: number | null;
  /** odometer reading the estimate was anchored to. */
  currentOdometerKm: number | null;
  /** odometer of the full-tank baseline entry. */
  baselineOdometerKm: number | null;
  /**
   * Litres consumed since the full-tank baseline (tankCapacity - remainingLitres
   * + litresAddedSince), i.e. what actually explains kmSinceFull. Exposed so
   * `extendMileageWithOpenTail` can close the still-open stretch without
   * recomputing this from scratch; null whenever no estimate could be made.
   */
  litresConsumedSinceBaseline: number | null;
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
  litresConsumedSinceBaseline: null,
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
  for (const f of fuelEntries) {
    if (f.odometerKm != null) consider(f.odometerKm, f.filledAt);
  }
  for (const c of odometerCheckins) consider(c.odometerKm, c.checkedAt);
  return best;
}

/** Most recent full-tank fuel entry with an odometer reading (by filledAt), or null. */
export function latestFullTank(fuelEntries: readonly FuelEntry[]): FuelEntry | null {
  let best: FuelEntry | null = null;
  for (const f of fuelEntries) {
    if (!f.isFullTank || f.odometerKm == null) continue;
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

  // latestFullTank() only ever returns entries with a known odometer reading.
  const baselineOdometerKm = baseline.odometerKm!;
  const kmSinceFull = Math.max(0, current.odometerKm - baselineOdometerKm);

  const baselineTime = Date.parse(baseline.filledAt);
  let litresAddedSince = 0;
  for (const f of fuelEntries) {
    if (Date.parse(f.filledAt) > baselineTime) {
      litresAddedSince += f.litresFilled ?? 0;
    }
  }

  const estimatedFuel =
    vehicle.tankCapacityLitres - kmSinceFull / mileage + litresAddedSince;
  const calcRemainingLitres = clamp(estimatedFuel, 0, vehicle.tankCapacityLitres);

  // Only reconcile against a tank-level guess that IS the current reading —
  // a stale one from before a later fill/check-in is no longer trustworthy.
  const observedCheckin = odometerCheckins.find(
    (c) => c.checkedAt === current.at && c.fuelPercent != null,
  );

  let remainingLitres = calcRemainingLitres;
  let effectiveMileage = mileage;
  let mileageUsed = usingCalcMileage ? mileage : null;

  if (observedCheckin) {
    const observedRemainingLitres = clamp(
      (observedCheckin.fuelPercent! / 100) * vehicle.tankCapacityLitres,
      0,
      vehicle.tankCapacityLitres,
    );
    remainingLitres = (calcRemainingLitres + observedRemainingLitres) / 2;

    const litresConsumedSinceFull =
      vehicle.tankCapacityLitres - remainingLitres + litresAddedSince;
    if (kmSinceFull > 0 && litresConsumedSinceFull > 0) {
      effectiveMileage = kmSinceFull / litresConsumedSinceFull;
      mileageUsed = effectiveMileage;
    }
  }

  const estimatedRangeKm = remainingLitres * effectiveMileage;
  const litresConsumedSinceBaseline =
    vehicle.tankCapacityLitres - remainingLitres + litresAddedSince;

  return {
    canEstimate: true,
    reason: 'ok',
    remainingLitres,
    estimatedRangeKm,
    atOrBelowReserve: remainingLitres <= vehicle.reserveThresholdLitres,
    mileageUsed,
    currentOdometerKm: current.odometerKm,
    baselineOdometerKm: baseline.odometerKm,
    litresConsumedSinceBaseline,
  };
}

