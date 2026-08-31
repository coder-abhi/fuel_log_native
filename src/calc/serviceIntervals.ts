/**
 * Service-interval mileage buckets — feeds the dashboard bar chart.
 *
 * Fuel entries are partitioned by service-record boundaries:
 *  - bucket 0: from the very first fuel entry up to the 1st service
 *  - bucket k: between service k and service k+1
 *  - last bucket: from the most recent service to "now" — marked `ongoing`
 *    (visually distinguished because it isn't closed yet)
 *
 * With no service records there is a single ongoing bucket covering all history.
 *
 * Each interval is assigned to a bucket by its END timestamp (later entry's
 * filledAt): interval belongs to bucket i when
 *   boundaryStart < endAt <= boundaryEnd
 * (the ongoing bucket has an open upper bound).
 */

import { buildIntervals, mileageFromIntervals } from './mileage';
import type { FuelEntry, ServiceRecord } from './types';

export interface ServiceIntervalBucket {
  index: number;
  label: string;
  /** service date that opens this bucket, or null for the first bucket. */
  startAt: string | null;
  /** service date that closes this bucket, or null for the ongoing bucket. */
  endAt: string | null;
  ongoing: boolean;
  kmPerLitre: number | null;
  totalKm: number;
  totalLitres: number;
  countedIntervals: number;
}

function sortedServices(services: readonly ServiceRecord[]): ServiceRecord[] {
  return [...services].sort(
    (a, b) => Date.parse(a.servicedAt) - Date.parse(b.servicedAt),
  );
}

export function serviceIntervalBuckets(
  entries: readonly FuelEntry[],
  services: readonly ServiceRecord[],
): ServiceIntervalBucket[] {
  const svc = sortedServices(services);
  const intervals = buildIntervals(entries);

  // Boundary timestamps: [-inf, s0, s1, ..., s(n-1), +inf]
  const bounds: (number | null)[] = [null, ...svc.map((s) => Date.parse(s.servicedAt)), null];
  const buckets: ServiceIntervalBucket[] = [];

  for (let i = 0; i < bounds.length - 1; i++) {
    const lo = bounds[i]; // null => -infinity
    const hi = bounds[i + 1]; // null => +infinity
    const ongoing = hi === null;

    const inBucket = intervals.filter((iv) => {
      const t = Date.parse(iv.endAt);
      const afterLo = lo === null ? true : t > lo;
      const beforeHi = hi === null ? true : t <= hi;
      return afterLo && beforeHi;
    });

    const m = mileageFromIntervals(inBucket);
    buckets.push({
      index: i,
      label: ongoing ? 'Ongoing' : `Interval ${i + 1}`,
      startAt: i === 0 ? null : svc[i - 1].servicedAt,
      endAt: ongoing ? null : svc[i].servicedAt,
      ongoing,
      kmPerLitre: m.kmPerLitre,
      totalKm: m.totalKm,
      totalLitres: m.totalLitres,
      countedIntervals: m.countedIntervals,
    });
  }

  return buckets;
}
