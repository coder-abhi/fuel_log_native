/**
 * Display formatters. Distance unit is per-vehicle-agnostic here; the app stores
 * everything in km and only swaps the *label* when a vehicle prefers miles
 * (conversion is intentionally out of scope for v1 — see spec).
 */

export function fmtNumber(n: number, maxFractionDigits = 1): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: maxFractionDigits });
}

export function fmtKm(n: number | null | undefined, digits = 0): string {
  if (n == null || Number.isNaN(n)) return '—';
  return fmtNumber(n, digits);
}

export function fmtLitres(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return '—';
  return fmtNumber(n, digits);
}

export function fmtMileage(kmPerLitre: number | null | undefined, digits = 1): string {
  if (kmPerLitre == null || Number.isNaN(kmPerLitre)) return '—';
  return fmtNumber(kmPerLitre, digits);
}

/** Indian-style currency; symbol only, grouping via locale. */
export function fmtCurrency(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `₹ ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

const DATE_FMT: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
};
const TIME_FMT: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
};

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, DATE_FMT);
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, DATE_FMT)}, ${d.toLocaleTimeString(undefined, TIME_FMT)}`;
}

/** "April 2025" style month header for grouped lists. */
export function fmtMonthHeader(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
