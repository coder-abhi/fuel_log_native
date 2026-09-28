import type { FuelEntry, OdometerCheckin, ServiceRecord } from '@/calc';

export type TimelineItem =
  | { kind: 'fuel'; at: string; odometerKm: number | null; data: FuelEntry }
  | { kind: 'odometer'; at: string; odometerKm: number; data: OdometerCheckin }
  | { kind: 'service'; at: string; odometerKm: number | null; data: ServiceRecord };

export type TimelineFilter = 'all' | 'fuel' | 'odometer' | 'service';

export function buildTimeline(
  fuelEntries: readonly FuelEntry[],
  checkins: readonly OdometerCheckin[],
  services: readonly ServiceRecord[],
): TimelineItem[] {
  const items: TimelineItem[] = [
    ...fuelEntries.map(
      (f): TimelineItem => ({ kind: 'fuel', at: f.filledAt, odometerKm: f.odometerKm, data: f }),
    ),
    ...checkins.map(
      (c): TimelineItem => ({
        kind: 'odometer',
        at: c.checkedAt,
        odometerKm: c.odometerKm,
        data: c,
      }),
    ),
    ...services.map(
      (s): TimelineItem => ({
        kind: 'service',
        at: s.servicedAt,
        odometerKm: s.odometerKm,
        data: s,
      }),
    ),
  ];
  // newest first
  items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return items;
}

export function filterTimeline(
  items: TimelineItem[],
  filter: TimelineFilter,
): TimelineItem[] {
  if (filter === 'all') return items;
  return items.filter((i) => i.kind === filter);
}

export function fuelKindLabel(f: FuelEntry): string {
  if (f.excludedFromMileage) return 'Missed fill';
  if (f.isApproximate) return 'Approximate';
  return f.isFullTank ? 'Full tank' : 'Partial';
}
