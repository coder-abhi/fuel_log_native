/**
 * Driving-pattern stats.
 *
 * Distance is ALWAYS trusted, so this combines odometer readings from BOTH
 * fuel_entries.odometer_km and odometer_checkins.odometer_km, sorted
 * chronologically, regardless of whether an interval was excluded from mileage
 * math. Only litres pairing is ever untrusted.
 *
 * Each consecutive pair of readings forms an interval with:
 *   deltaKm  = later.odometerKm - earlier.odometerKm   (intervals with deltaKm <= 0 are ignored)
 *   midpoint = instant halfway between the two reading timestamps
 *
 * Outputs:
 *  - kmThisWeek / kmThisMonth: sum of deltaKm for intervals whose midpoint falls
 *    in the current local week / month.
 *  - weekdayAvgKm / weekendAvgKm: mean of deltaKm over intervals whose midpoint
 *    lands on a weekday (Mon–Fri) vs weekend (Sat/Sun). null when no such interval.
 *  - kmByWeekday: total deltaKm grouped by midpoint day-of-week (Mon..Sun),
 *    scoped to the current local month (matches the "this month" bar chart).
 */

import type { FuelEntry, OdometerCheckin, OdometerReading } from './types';
import {
  isWeekend,
  isoWeekday,
  inWindow,
  midpointIso,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  type WeekStart,
} from './time';

export interface DrivingInterval {
  deltaKm: number;
  midpoint: string;
}

export interface DrivingPatternStats {
  kmThisWeek: number;
  kmThisMonth: number;
  weekdayAvgKm: number | null;
  weekendAvgKm: number | null;
  /** index 0 = Monday .. 6 = Sunday */
  kmByWeekday: number[];
  intervalCount: number;
}

export function buildOdometerTimeline(
  fuelEntries: readonly FuelEntry[],
  odometerCheckins: readonly OdometerCheckin[],
): OdometerReading[] {
  const readings: OdometerReading[] = [
    ...fuelEntries
      .filter((f): f is FuelEntry & { odometerKm: number } => f.odometerKm != null)
      .map(
        (f): OdometerReading => ({
          odometerKm: f.odometerKm,
          at: f.filledAt,
          source: 'fuel',
          sourceId: f.id,
        }),
      ),
    ...odometerCheckins.map(
      (c): OdometerReading => ({
        odometerKm: c.odometerKm,
        at: c.checkedAt,
        source: 'checkin',
        sourceId: c.id,
      }),
    ),
  ];
  readings.sort((a, b) => {
    const t = Date.parse(a.at) - Date.parse(b.at);
    if (t !== 0) return t;
    // deterministic tie-break
    if (a.source !== b.source) return a.source === 'fuel' ? -1 : 1;
    return a.sourceId - b.sourceId;
  });
  return readings;
}

export function buildDrivingIntervals(
  readings: readonly OdometerReading[],
): DrivingInterval[] {
  const out: DrivingInterval[] = [];
  for (let i = 1; i < readings.length; i++) {
    const a = readings[i - 1];
    const b = readings[i];
    const deltaKm = b.odometerKm - a.odometerKm;
    if (deltaKm <= 0) continue;
    out.push({ deltaKm, midpoint: midpointIso(a.at, b.at) });
  }
  return out;
}

export function drivingPatternStats(params: {
  fuelEntries: readonly FuelEntry[];
  odometerCheckins: readonly OdometerCheckin[];
  now?: Date;
  weekStartsOn?: WeekStart;
}): DrivingPatternStats {
  const now = params.now ?? new Date();
  const weekStartsOn = params.weekStartsOn ?? 1;

  const timeline = buildOdometerTimeline(params.fuelEntries, params.odometerCheckins);
  const intervals = buildDrivingIntervals(timeline);

  const weekStart = startOfWeek(now, weekStartsOn);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  let kmThisWeek = 0;
  let kmThisMonth = 0;
  const weekdayDeltas: number[] = [];
  const weekendDeltas: number[] = [];
  const kmByWeekday = [0, 0, 0, 0, 0, 0, 0];

  for (const iv of intervals) {
    const mid = new Date(iv.midpoint);
    if (inWindow(mid, weekStart, weekEnd)) kmThisWeek += iv.deltaKm;
    if (inWindow(mid, monthStart, monthEnd)) {
      kmThisMonth += iv.deltaKm;
      kmByWeekday[isoWeekday(mid)] += iv.deltaKm;
    }
    if (isWeekend(mid)) weekendDeltas.push(iv.deltaKm);
    else weekdayDeltas.push(iv.deltaKm);
  }

  const mean = (xs: number[]): number | null =>
    xs.length === 0 ? null : xs.reduce((s, x) => s + x, 0) / xs.length;

  return {
    kmThisWeek,
    kmThisMonth,
    weekdayAvgKm: mean(weekdayDeltas),
    weekendAvgKm: mean(weekendDeltas),
    kmByWeekday,
    intervalCount: intervals.length,
  };
}
