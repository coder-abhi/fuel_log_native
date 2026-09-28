/**
 * Mileage (km / litre) calculation — the core of MileTrack.
 *
 * General principle:
 *  - Walk fuel entries that have an odometer reading, in chronological order
 *    (by filledAt). Entries logged without an odometer reading (odometer is
 *    optional-but-recommended — see AddFuelSheet) simply don't participate in
 *    this chain: they still count toward cost/litres totals elsewhere, but
 *    contribute no distance data point.
 *  - For each consecutive pair the "interval" is:
 *      deltaKm     = later.odometerKm - earlier.odometerKm
 *      deltaLitres = earlier.litresFilled  (falling back to later.litresFilled
 *                    when earlier's is unknown — see below)
 *  - Litres are attributed to the EARLIER fill, not the later one: the fuel you
 *    just put in at `later` hasn't been used yet, so it can't explain the
 *    distance you already covered to get there. What explains that distance is
 *    the fuel that was already in the tank — i.e. what you added at `earlier`.
 *    The litres added at `later` instead become the numerator for the NEXT
 *    interval, once a future entry closes it.
 *  - Fallback: when `earlier.litresFilled` is null (a "missed fill, no
 *    estimate" marker — see excludedFromMileage below), there is nothing to
 *    shift forward, so this interval falls back to `later.litresFilled`
 *    instead, exactly like the un-shifted model would. This keeps a
 *    missed-fill marker from poisoning the interval that immediately follows
 *    it, on top of the (always poisoned) interval that precedes it.
 *  - If later.excludedFromMileage === true, skip the interval entirely for
 *    mileage math (its distance still counts in driving-pattern stats, which
 *    live in a different module) — the user has flagged that they don't trust
 *    this gap (e.g. a forgotten fill-up happened somewhere inside it).
 *  - is_full_tank / is_approximate never change the math; they are informational.
 *
 * Defensive rules not spelled out above:
 *  - An interval whose deltaKm <= 0 (odometer went backwards or unchanged —
 *    bad data / typo) is excluded so it cannot corrupt the running sums.
 *  - An interval that ends up with no litres to attribute at all (both ends
 *    null — shouldn't happen given the app's own input rules, but the data
 *    could come from an import) is excluded rather than silently treated as
 *    zero litres, which would otherwise inflate the computed mileage.
 */

import { dayStart } from './time';
import type { FuelEntry, ServiceRecord } from './types';

export interface MileageInterval {
  fromEntryId: number;
  toEntryId: number;
  /** later.filledAt — used for service-window filtering & bucketing. */
  endAt: string;
  deltaKm: number;
  deltaLitres: number;
  /** true => not counted in mileage sums (explicitly excluded OR bad data). */
  excluded: boolean;
  /** which exclusion applied, for UI / debugging. */
  excludedReason: 'none' | 'flagged' | 'non-positive-distance' | 'no-litres-data';
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

/**
 * Build the ordered list of intervals between consecutive fuel entries that
 * have an odometer reading. Entries logged without one (odometer is optional)
 * are skipped when walking the chain — they can't anchor a distance.
 */
export function buildIntervals(entries: readonly FuelEntry[]): MileageInterval[] {
  const sorted = sortFuelEntries(entries).filter((e) => e.odometerKm != null);
  const out: MileageInterval[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const earlier = sorted[i - 1];
    const later = sorted[i];
    const deltaKm = later.odometerKm! - earlier.odometerKm!;
    const deltaLitres = earlier.litresFilled ?? later.litresFilled ?? 0;

    let excluded = false;
    let excludedReason: MileageInterval['excludedReason'] = 'none';
    if (later.excludedFromMileage) {
      excluded = true;
      excludedReason = 'flagged';
    } else if (deltaKm <= 0) {
      excluded = true;
      excludedReason = 'non-positive-distance';
    } else if (deltaLitres <= 0) {
      excluded = true;
      excludedReason = 'no-litres-data';
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
 * later entry (endAt) falls on or after the most recent service's calendar day.
 * A fill logged on the SAME DAY as a service counts as after it — the service is
 * assumed to have happened first, then the tank got filled. With no service
 * records this is identical to lifetime mileage.
 */
export function sinceLastServiceMileage(
  entries: readonly FuelEntry[],
  services: readonly ServiceRecord[],
): MileageResult {
  const svc = latestService(services);
  const intervals = buildIntervals(entries);
  if (!svc) return mileageFromIntervals(intervals);
  const cutoffDay = dayStart(svc.servicedAt);
  return mileageFromIntervals(intervals.filter((iv) => dayStart(iv.endAt) >= cutoffDay));
}
