/** dd-mm-yy / dd-mm-yyyy date handling for the scenario CLI (display + wizard input). */

/** Parses "dd-mm-yy" or "dd-mm-yyyy" into an ISO string at a fixed 08:00 UTC. Null if invalid. */
export function parseDdMmYy(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{2}|\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day, 8, 0, 0, 0));
  // rejects overflow dates like 31-02-25 (Date would otherwise roll into March)
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return d.toISOString();
}

/** Formats an ISO timestamp as dd-mm-yy for display. */
export function fmtDdMmYy(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yy = String(d.getUTCFullYear() % 100).padStart(2, '0');
  return `${dd}-${mm}-${yy}`;
}
