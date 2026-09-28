/**
 * Small date helpers used by the calculation layer. Kept dependency-free.
 * All "period" math (this week / this month / day-of-week) is done in LOCAL time,
 * because that is how a user thinks about "how much did I drive this month".
 */

export type WeekStart = 0 | 1; // 0 = Sunday, 1 = Monday

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function toDate(iso: string): Date {
  return new Date(iso);
}

/** Midpoint instant between two ISO timestamps, as an ISO string. */
export function midpointIso(aIso: string, bIso: string): string {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return new Date((a + b) / 2).toISOString();
}

/** 0 (Mon) .. 6 (Sun) — ISO-style weekday index, handy for weekday/weekend split. */
export function isoWeekday(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function isWeekend(d: Date): boolean {
  const wd = d.getDay();
  return wd === 0 || wd === 6;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function startOfWeek(d: Date, weekStartsOn: WeekStart = 1): Date {
  const x = startOfDay(d);
  const diff = (x.getDay() - weekStartsOn + 7) % 7;
  x.setDate(x.getDate() - diff);
  return x;
}

export function startOfMonth(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

export function endOfMonth(d: Date): Date {
  const x = startOfMonth(d);
  x.setMonth(x.getMonth() + 1);
  return x;
}

/** Local midnight for the day an ISO timestamp falls on, as a comparable number. */
export function dayStart(iso: string): number {
  return startOfDay(new Date(iso)).getTime();
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** inclusive-start, exclusive-end window check */
export function inWindow(d: Date, startInclusive: Date, endExclusive: Date): boolean {
  const t = d.getTime();
  return t >= startInclusive.getTime() && t < endExclusive.getTime();
}
