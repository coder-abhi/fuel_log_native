/**
 * Fuel-balance mileage — the model behind the "Lifetime mileage" and
 * "Since-last-service" dashboard headline figures.
 *
 * Unlike buildIntervals()/lifetimeMileage() in mileage.ts (fill-to-fill,
 * still used for the trend line and the service-interval bar chart), this
 * walks the full fuel history as a sequence of "fuel-balance segments":
 *
 *  - A segment OPENS wherever the tank's fuel level is actually known: a
 *    full-tank fill (level = tank capacity), or the very first usable entry
 *    in a run of history where nothing else is known (level assumed = 0 —
 *    the simplest honest default when there's truly no prior data).
 *  - A segment CLOSES wherever the level is next known: a later full-tank
 *    fill, or "now" (via the estimated-remaining-fuel figure — same
 *    reconciled odometer + estimated/observed-remaining-fuel number already
 *    shown on the Range card).
 *  - Within a segment, EVERY litre filled (partial top-ups included) plus
 *    the known starting level, minus the known ending level, is exactly how
 *    much fuel was burned — no per-fill shifting or guessing, because both
 *    ends are pinned to a real, known quantity. Distance is simply
 *    odometer(end) - odometer(start).
 *  - A full-tank fill's OWN litres are excluded from the segment it opens
 *    (they were needed to reach that fullness, and belong to whatever came
 *    before) but INCLUDED in the segment it closes (they're what topped the
 *    tank back up, so they're part of what explains that segment's distance).
 *  - A flagged "missed fill" entry (excludedFromMileage) breaks the fuel
 *    side of the accounting for whatever segment was open: a purchase
 *    outside the record means the running litres total would undercount,
 *    making mileage look artificially good. So that segment is discarded
 *    entirely (distance AND litres both dropped), and a fresh segment starts
 *    at the flagged entry itself, under the same "known level or assume
 *    empty" rule as any other segment start.
 */

import { currentOdometer, estimateRemainingFuel } from './fuel';
import { latestService, sortFuelEntries, type MileageResult } from './mileage';
import { dayStart } from './time';
import type { FuelEntry, OdometerCheckin, ServiceRecord, Vehicle } from './types';

export interface FuelBalanceSegment {
  startAt: string;
  endAt: string;
  distanceKm: number;
  litresConsumed: number;
}

interface OpenSegment {
  startEntry: FuelEntry; // always has odometerKm != null
  startFuel: number; // 0 or vehicle.tankCapacityLitres
  runningLitres: number;
}

function startSegment(entry: FuelEntry, vehicle: Vehicle): OpenSegment {
  return {
    startEntry: entry,
    startFuel: entry.isFullTank ? vehicle.tankCapacityLitres : 0,
    runningLitres: entry.isFullTank ? 0 : entry.litresFilled ?? 0,
  };
}

function buildFuelBalanceSegments(
  fuelEntries: readonly FuelEntry[],
  vehicle: Vehicle,
): { closed: FuelBalanceSegment[]; open: OpenSegment | null } {
  const sorted = sortFuelEntries(fuelEntries);
  const closed: FuelBalanceSegment[] = [];
  let open: OpenSegment | null = null;

  for (const entry of sorted) {
    if (entry.excludedFromMileage) {
      open = entry.odometerKm != null ? startSegment(entry, vehicle) : null;
      continue;
    }

    if (open == null) {
      if (entry.odometerKm != null) open = startSegment(entry, vehicle);
      continue; // entries before the first anchor can't participate
    }

    open.runningLitres += entry.litresFilled ?? 0;

    if (entry.isFullTank && entry.odometerKm != null) {
      const distanceKm = entry.odometerKm - open.startEntry.odometerKm!;
      const litresConsumed = open.startFuel + open.runningLitres - vehicle.tankCapacityLitres;
      if (distanceKm > 0 && litresConsumed > 0) {
        closed.push({ startAt: open.startEntry.filledAt, endAt: entry.filledAt, distanceKm, litresConsumed });
        open = startSegment(entry, vehicle);
      }
      // else: degenerate close (bad/duplicate odometer) — keep the segment running.
    }
  }

  return { closed, open };
}

function closeOpenSegment(
  open: OpenSegment,
  vehicle: Vehicle,
  fuelEntries: readonly FuelEntry[],
  odometerCheckins: readonly OdometerCheckin[],
  services: readonly ServiceRecord[],
): FuelBalanceSegment | null {
  const current = currentOdometer(fuelEntries, odometerCheckins);
  if (!current) return null;
  const startOdo = open.startEntry.odometerKm!;
  const distanceKm = current.odometerKm - startOdo;
  if (distanceKm <= 0) return null;

  let litresConsumed: number;
  if (open.startFuel === vehicle.tankCapacityLitres) {
    // Opened on a full tank — reuse the live remaining-fuel estimate instead
    // of recomputing the same odometer + estimated/observed-remaining-fuel
    // reasoning from scratch.
    const estimate = estimateRemainingFuel({ vehicle, fuelEntries, odometerCheckins, services });
    if (estimate.litresConsumedSinceBaseline == null) return null;
    litresConsumed = estimate.litresConsumedSinceBaseline;
  } else {
    // No full-tank anchor for this segment (e.g. resumed right after a
    // flagged gap with a partial fill) — nothing to reconcile a tank level
    // against, so fall back to the plain running total.
    litresConsumed = open.runningLitres;
  }
  if (litresConsumed <= 0) return null;
  return { startAt: open.startEntry.filledAt, endAt: current.at, distanceKm, litresConsumed };
}

function sumSegments(segments: readonly FuelBalanceSegment[]): MileageResult {
  let totalKm = 0;
  let totalLitres = 0;
  for (const s of segments) {
    totalKm += s.distanceKm;
    totalLitres += s.litresConsumed;
  }
  return {
    kmPerLitre: totalLitres > 0 ? totalKm / totalLitres : null,
    totalKm,
    totalLitres,
    countedIntervals: segments.length,
  };
}

function allSegments(
  fuelEntries: readonly FuelEntry[],
  vehicle: Vehicle,
  odometerCheckins: readonly OdometerCheckin[],
  services: readonly ServiceRecord[],
): FuelBalanceSegment[] {
  const { closed, open } = buildFuelBalanceSegments(fuelEntries, vehicle);
  const finalOpen = open ? closeOpenSegment(open, vehicle, fuelEntries, odometerCheckins, services) : null;
  return finalOpen ? [...closed, finalOpen] : closed;
}

/** Lifetime mileage — fuel-balance model, see file doc comment. */
export function lifetimeMileageFuelBalance(
  fuelEntries: readonly FuelEntry[],
  vehicle: Vehicle,
  odometerCheckins: readonly OdometerCheckin[],
  services: readonly ServiceRecord[],
): MileageResult {
  return sumSegments(allSegments(fuelEntries, vehicle, odometerCheckins, services));
}

/**
 * Since-last-service mileage — fuel-balance model, only segments that fall
 * entirely on/after the most recent service's calendar day (a segment
 * straddling the service date is left out rather than misattributed; a
 * segment starting the SAME DAY as the service counts as after it, matching
 * the same-day tie-break used elsewhere).
 */
export function sinceLastServiceMileageFuelBalance(
  fuelEntries: readonly FuelEntry[],
  vehicle: Vehicle,
  odometerCheckins: readonly OdometerCheckin[],
  services: readonly ServiceRecord[],
): MileageResult {
  const svc = latestService(services);
  const segments = allSegments(fuelEntries, vehicle, odometerCheckins, services);
  if (!svc) return sumSegments(segments);
  const cutoffDay = dayStart(svc.servicedAt);
  return sumSegments(segments.filter((s) => dayStart(s.startAt) >= cutoffDay));
}
