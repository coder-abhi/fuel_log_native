/**
 * Chronology guard for odometer entry.
 *
 * The odometer only ever goes up. Whenever the user logs a reading (fuel fill,
 * check-in, or a service with an odometer) at some timestamp `at`, it must sit
 * between the two readings chronologically adjacent to it — no lower than
 * whatever was logged right before `at`, no higher than whatever was logged
 * right after it. This holds regardless of whether `at` is "now" or a
 * backdated entry somewhere in the middle of history, which a check against
 * only the single latest reading (the old approach) does not catch.
 */

export interface OdometerPoint {
  /** ISO timestamp. */
  at: string;
  odometerKm: number;
}

export interface OdometerNeighbors {
  prev: OdometerPoint | null;
  next: OdometerPoint | null;
}

/**
 * The reading immediately before and immediately after `at` among `points`.
 * Ties (identical timestamps) are treated as "before" `at` so that editing a
 * reading in place doesn't see itself as its own neighbor (callers should
 * still exclude the entry being edited from `points`).
 */
export function nearestOdometerNeighbors(
  points: readonly OdometerPoint[],
  at: string,
): OdometerNeighbors {
  const t = Date.parse(at);
  let prev: OdometerPoint | null = null;
  let next: OdometerPoint | null = null;
  for (const p of points) {
    const pt = Date.parse(p.at);
    if (pt <= t) {
      if (!prev || pt > Date.parse(prev.at)) prev = p;
    } else {
      if (!next || pt < Date.parse(next.at)) next = p;
    }
  }
  return { prev, next };
}

export type OdometerOrderViolation = 'below-earlier' | 'above-later' | null;

/**
 * Checks a candidate odometer reading against its chronological neighbors.
 * Returns which rule it breaks, or null when it fits.
 */
export function odometerOrderViolation(
  odometerKm: number,
  neighbors: OdometerNeighbors,
): OdometerOrderViolation {
  if (neighbors.prev && odometerKm < neighbors.prev.odometerKm) return 'below-earlier';
  if (neighbors.next && odometerKm > neighbors.next.odometerKm) return 'above-later';
  return null;
}
