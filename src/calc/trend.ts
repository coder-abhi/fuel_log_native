/**
 * Mileage trend points — a single-line "how has my km/l moved over time" series.
 *
 * NOT the dropped km-vs-fuel dual-line chart. Each point is the *running*
 * lifetime mileage recomputed after each counted (non-excluded) fuel interval,
 * so the line smooths out toward the true average as history accumulates. Used
 * by the small trend sparkline on the dashboard / Stats screen in the mock.
 */

import { buildIntervals } from './mileage';
import type { FuelEntry } from './types';

export interface TrendPoint {
  at: string;
  /** running lifetime km/l up to and including this interval. */
  kmPerLitre: number;
}

export function mileageTrendPoints(entries: readonly FuelEntry[]): TrendPoint[] {
  const intervals = buildIntervals(entries);
  const points: TrendPoint[] = [];
  let km = 0;
  let litres = 0;
  for (const iv of intervals) {
    if (iv.excluded) continue;
    km += iv.deltaKm;
    litres += iv.deltaLitres;
    if (litres > 0) points.push({ at: iv.endAt, kmPerLitre: km / litres });
  }
  return points;
}
