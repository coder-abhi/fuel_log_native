/**
 * Mileage (km / litre) calculation — the core of MileTrack.
 *
 * General principle (from the spec):
 *  - Walk fuel entries in chronological order (by filledAt).
 *  - For each consecutive pair the "interval" is:
 *      deltaKm     = later.odometerKm - earlier.odometerKm
 *      deltaLitres = later.litresFilled
 *  - If later.excludedFromMileage === true, skip the interval entirely for
 *    mileage math (its distance still counts in driving-pattern stats, which
 *    live in a different module).
 *  - Otherwise add deltaKm to totalKm and deltaLitres to totalLitres. This is
 *    identical for full / partial / approximate fills — the running-sum estimate
 *    converges regardless of individual fill sizes.
 *  - is_full_tank / is_approximate never change the math; they are informational.
 *
 * Defensive rule not spelled out in the spec: an interval whose deltaKm <= 0
 * (odometer went backwards or unchanged — bad data / typo) is treated as
 * excluded from mileage math so it cannot corrupt the running sums.
 */

import type { FuelEntry, ServiceRecord } from './types';

export interface MileageInterval {
  fromEntryId: number;
  toEntryId: number;
  /** later.filledAt — used for service-window filtering & bucketing. */
  endAt: string;
  deltaKm: number;
  deltaLitres: number;
  /** true => not counted in mileage sums (explicitly excluded OR non-positive deltaKm). */
  excluded: boolean;
  /** which exclusion applied, for UI / debugging. */
  excludedReason: 'none' | 'flagged' | 'non-positive-distance';
}

export interface MileageResult {
  /** km per litre, or null when there is not yet enough data. */
  kmPerLitre: number | null;
  totalKm: number;
  totalLitres: number;
  /** number of intervals that actually contributed to the sums. */
  countedIntervals: number;
}

/** Stable chronological sort: filledAt, then createdAt, then id. */
export function sortFuelEntries(entries: readonly FuelEntry[]): FuelEntry[] {
  return [...entries].sort((a, b) => {
    const t = Date.parse(a.filledAt) - Date.parse(b.filledAt);
    if (t !== 0) return t;
    const c = Date.parse(a.createdAt) - Date.parse(b.createdAt);
    if (c !== 0) return c;
    return a.id - b.id;
  });
}

/** Build the ordered list of intervals between consecutive fuel entries. */
export function buildIntervals(entries: readonly FuelEntry[]): MileageInterval[] {
  const sorted = sortFuelEntries(entries);
  const out: MileageInterval[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const earlier = sorted[i - 1];
    const later = sorted[i];
    const deltaKm = later.odometerKm - earlier.odometerKm;
    const deltaLitres = later.litresFilled ?? 0;

    let excluded = false;
    let excludedReason: MileageInterval['excludedReason'] = 'none';
    if (later.excludedFromMileage) {
      excluded = true;
      excludedReason = 'flagged';
    } else if (deltaKm <= 0) {
      excluded = true;
      excludedReason = 'non-positive-distance';
    }

    out.push({
      fromEntryId: earlier.id,
      toEntryId: later.id,
      endAt: later.filledAt,
      deltaKm,
      deltaLitres,
      excluded,
      excludedReason,
    });
  }
  return out;
}

/** Sum a set of intervals into a mileage figure. */
export function mileageFromIntervals(intervals: readonly MileageInterval[]): MileageResult {
  let totalKm = 0;
  let totalLitres = 0;
  let countedIntervals = 0;
  for (const iv of intervals) {
    if (iv.excluded) continue;
    totalKm += iv.deltaKm;
    totalLitres += iv.deltaLitres;
    countedIntervals += 1;
  }
  const kmPerLitre = totalLitres > 0 ? totalKm / totalLitres : null;
  return { kmPerLitre, totalKm, totalLitres, countedIntervals };
}

/**
 * Lifetime mileage — total_km / total_litres across the entire history of
 * non-excluded intervals. This is the dashboard headline number ("Mileage").
 */
export function lifetimeMileage(entries: readonly FuelEntry[]): MileageResult {
  return mileageFromIntervals(buildIntervals(entries));
}

/** The most recent service record by servicedAt, or null. */
export function latestService(services: readonly ServiceRecord[]): ServiceRecord | null {
  let latest: ServiceRecord | null = null;
  for (const s of services) {
    if (!latest || Date.parse(s.servicedAt) > Date.parse(latest.servicedAt)) {
      latest = s;
    }
  }
  return latest;
}

/**
 * Since-last-service mileage — same formula as lifetime, but only intervals whose
 * later entry (endAt) is strictly after the most recent service date.
 * With no service records this is identical to lifetime mileage.
 */
export function sinceLastServiceMileage(
  entries: readonly FuelEntry[],
  services: readonly ServiceRecord[],
): MileageResult {
  const svc = latestService(services);
  const intervals = buildIntervals(entries);
  if (!svc) return mileageFromIntervals(intervals);
  const cutoff = Date.parse(svc.servicedAt);
  return mileageFromIntervals(intervals.filter((iv) => Date.parse(iv.endAt) > cutoff));
}
