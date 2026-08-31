/** Parse a user-typed numeric string. Returns null when blank / not a number. */
export function parseNum(s: string | null | undefined): number | null {
  if (s == null) return null;
  const cleaned = s.replace(/,/g, '').trim();
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function isPositive(n: number | null): n is number {
  return n != null && n > 0;
}

export function isNonNegative(n: number | null): n is number {
  return n != null && n >= 0;
}
