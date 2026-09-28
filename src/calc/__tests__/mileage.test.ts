import {
  buildIntervals,
  lifetimeMileage,
  sinceLastServiceMileage,
  sortFuelEntries,
} from '../mileage';
import { fuel, service, resetIds, localIso } from './helpers';

beforeEach(resetIds);

describe('sortFuelEntries', () => {
  it('orders by filledAt, then createdAt, then id', () => {
    const a = fuel({ id: 10, filledAt: '2025-01-03T00:00:00.000Z' });
    const b = fuel({ id: 11, filledAt: '2025-01-01T00:00:00.000Z' });
    const c = fuel({
      id: 12,
      filledAt: '2025-01-02T00:00:00.000Z',
      createdAt: '2025-01-02T00:00:00.000Z',
    });
    const d = fuel({
      id: 13,
      filledAt: '2025-01-02T00:00:00.000Z',
      createdAt: '2025-01-01T00:00:00.000Z',
    });
    expect(sortFuelEntries([a, b, c, d]).map((e) => e.id)).toEqual([11, 13, 12, 10]);
  });
});

describe('lifetimeMileage — normal full-tank sequence', () => {
  it('sum(km) / sum(litres) across all intervals', () => {
    // 0 -> 400 (40L) -> 800 (38L) -> 1150 (35L)
    const entries = [
      fuel({ odometerKm: 0, litresFilled: 30, isFullTank: true, filledAt: '2025-01-01T00:00:00.000Z' }),
      fuel({ odometerKm: 400, litresFilled: 40, isFullTank: true, filledAt: '2025-01-08T00:00:00.000Z' }),
      fuel({ odometerKm: 800, litresFilled: 38, isFullTank: true, filledAt: '2025-01-15T00:00:00.000Z' }),
      fuel({ odometerKm: 1150, litresFilled: 35, isFullTank: true, filledAt: '2025-01-22T00:00:00.000Z' }),
    ];
    const r = lifetimeMileage(entries);
    // litres are attributed to the EARLIER fill of each interval (the fuel
    // that was actually in the tank for that stretch) — the last entry's
    // litres never count (no interval starts there yet).
    expect(r.totalKm).toBe(1150);
    expect(r.totalLitres).toBe(30 + 40 + 38);
    expect(r.kmPerLitre).toBeCloseTo(1150 / 108, 6);
    expect(r.countedIntervals).toBe(3);
  });
});

describe('lifetimeMileage — partial-only sequence', () => {
  it('treats partial fills identically to full ones', () => {
    const entries = [
      fuel({ odometerKm: 1000, litresFilled: 5, filledAt: '2025-02-01T00:00:00.000Z' }),
      fuel({ odometerKm: 1200, litresFilled: 4, filledAt: '2025-02-05T00:00:00.000Z' }),
      fuel({ odometerKm: 1400, litresFilled: 4.5, filledAt: '2025-02-10T00:00:00.000Z' }),
    ];
    const r = lifetimeMileage(entries);
    expect(r.totalKm).toBe(400);
    expect(r.totalLitres).toBe(9);
    expect(r.kmPerLitre).toBeCloseTo(400 / 9, 6);
  });
});

describe('lifetimeMileage — approximate entries', () => {
  it('is_approximate does not change the math', () => {
    const normal = [
      fuel({ odometerKm: 0, litresFilled: 10, filledAt: '2025-03-01T00:00:00.000Z' }),
      fuel({ odometerKm: 300, litresFilled: 20, filledAt: '2025-03-03T00:00:00.000Z' }),
    ];
    const approx = [
      fuel({ odometerKm: 0, litresFilled: 10, filledAt: '2025-03-01T00:00:00.000Z' }),
      fuel({
        odometerKm: 300,
        litresFilled: 20,
        isApproximate: true,
        filledAt: '2025-03-03T00:00:00.000Z',
      }),
    ];
    expect(lifetimeMileage(approx).kmPerLitre).toBe(lifetimeMileage(normal).kmPerLitre);
  });
});

describe('lifetimeMileage — excluded intervals', () => {
  it('skips km AND litres of an interval whose later entry is excluded', () => {
    const entries = [
      fuel({ odometerKm: 0, litresFilled: 10, filledAt: '2025-04-01T00:00:00.000Z' }),
      // big gap the user does not remember litres for -> excluded, litres null
      fuel({
        odometerKm: 900,
        litresFilled: null,
        excludedFromMileage: true,
        filledAt: '2025-04-10T00:00:00.000Z',
      }),
      fuel({ odometerKm: 1100, litresFilled: 12, filledAt: '2025-04-15T00:00:00.000Z' }),
    ];
    const r = lifetimeMileage(entries);
    // interval 1 (0 -> 900) is excluded because its LATER entry is flagged.
    // interval 2 (900 -> 1100) would normally attribute litres to its earlier
    // entry (900), but that entry's litres are unknown (null) — the missed-fill
    // marker acts like a reset point, so this interval falls back to using the
    // litres of its OWN later entry (1100's 12L) instead.
    expect(r.totalKm).toBe(200);
    expect(r.totalLitres).toBe(12);
    expect(r.countedIntervals).toBe(1);
  });
});

describe('buildIntervals — litres attribution shift', () => {
  it("attributes an interval's litres to the EARLIER fill, not the later one", () => {
    // Filling 10L to reach 830km should not count as fuel used to GET to
    // 830km — that fuel is only used going forward from here.
    const entries = [
      fuel({ odometerKm: 800, litresFilled: 8, filledAt: '2025-06-01T00:00:00.000Z' }),
      fuel({ odometerKm: 830, litresFilled: 10, filledAt: '2025-06-05T00:00:00.000Z' }),
    ];
    const ivs = buildIntervals(entries);
    expect(ivs).toHaveLength(1);
    expect(ivs[0].deltaKm).toBe(30);
    expect(ivs[0].deltaLitres).toBe(8); // the 800km fill's litres, not the 10L just added
  });

  it('the most recent fill\'s litres are not counted until a future entry closes the interval', () => {
    const entries = [
      fuel({ odometerKm: 800, litresFilled: 8, filledAt: '2025-06-01T00:00:00.000Z' }),
      fuel({ odometerKm: 830, litresFilled: 10, filledAt: '2025-06-05T00:00:00.000Z' }),
    ];
    expect(lifetimeMileage(entries).totalLitres).toBe(8);
    const withNext = [...entries, fuel({ odometerKm: 850, litresFilled: 5, filledAt: '2025-06-10T00:00:00.000Z' })];
    // now the 830km entry's 10L closes the second interval
    expect(lifetimeMileage(withNext).totalLitres).toBe(8 + 10);
  });
});

describe('buildIntervals — entries without an odometer reading', () => {
  it('are skipped entirely when walking the mileage chain', () => {
    const entries = [
      fuel({ odometerKm: 0, litresFilled: 10, filledAt: '2025-07-01T00:00:00.000Z' }),
      // logged without checking the odometer — optional, but not usable here
      fuel({ odometerKm: null, litresFilled: 5, filledAt: '2025-07-05T00:00:00.000Z' }),
      fuel({ odometerKm: 300, litresFilled: 20, filledAt: '2025-07-10T00:00:00.000Z' }),
    ];
    const ivs = buildIntervals(entries);
    expect(ivs).toHaveLength(1);
    expect(ivs[0].fromEntryId).toBe(entries[0].id);
    expect(ivs[0].toEntryId).toBe(entries[2].id);
    expect(ivs[0].deltaKm).toBe(300);
    expect(ivs[0].deltaLitres).toBe(10);
  });
});

describe('buildIntervals — defensive no-litres-data', () => {
  it('excludes an interval that ends up with nothing to attribute', () => {
    const entries = [
      fuel({ odometerKm: 0, litresFilled: null, filledAt: '2025-08-01T00:00:00.000Z' }),
      fuel({ odometerKm: 200, litresFilled: null, filledAt: '2025-08-05T00:00:00.000Z' }),
    ];
    const ivs = buildIntervals(entries);
    expect(ivs[0].excluded).toBe(true);
    expect(ivs[0].excludedReason).toBe('no-litres-data');
  });
});

describe('buildIntervals — defensive non-positive distance', () => {
  it('excludes an interval where the odometer did not advance', () => {
    const entries = [
      fuel({ odometerKm: 500, litresFilled: 10, filledAt: '2025-05-01T00:00:00.000Z' }),
      fuel({ odometerKm: 480, litresFilled: 10, filledAt: '2025-05-02T00:00:00.000Z' }),
      fuel({ odometerKm: 900, litresFilled: 20, filledAt: '2025-05-05T00:00:00.000Z' }),
    ];
    const ivs = buildIntervals(entries);
    expect(ivs[0].excluded).toBe(true);
    expect(ivs[0].excludedReason).toBe('non-positive-distance');
    const r = lifetimeMileage(entries);
    expect(r.totalKm).toBe(420);
    // litres come from the earlier fill of the surviving interval (480 -> 900)
    expect(r.totalLitres).toBe(10);
  });
});

describe('mileage figures — not enough data', () => {
  it('returns null km/l with 0/1 entries', () => {
    expect(lifetimeMileage([]).kmPerLitre).toBeNull();
    expect(lifetimeMileage([fuel({ odometerKm: 10, litresFilled: 5 })]).kmPerLitre).toBeNull();
  });
});

describe('sinceLastServiceMileage', () => {
  const entries = [
    fuel({ odometerKm: 0, litresFilled: 10, filledAt: '2025-01-01T00:00:00.000Z' }),
    fuel({ odometerKm: 400, litresFilled: 20, filledAt: '2025-02-01T00:00:00.000Z' }),
    fuel({ odometerKm: 800, litresFilled: 25, filledAt: '2025-04-01T00:00:00.000Z' }),
    fuel({ odometerKm: 1100, litresFilled: 20, filledAt: '2025-05-01T00:00:00.000Z' }),
  ];

  it('equals lifetime mileage when there is no service record', () => {
    expect(sinceLastServiceMileage(entries, []).kmPerLitre).toBe(
      lifetimeMileage(entries).kmPerLitre,
    );
  });

  it('only counts intervals ending strictly after the most recent service', () => {
    const services = [
      service({ servicedAt: '2025-01-15T00:00:00.000Z' }),
      service({ servicedAt: '2025-03-01T00:00:00.000Z' }),
    ];
    // intervals ending 2025-04-01 (400km/25L) and 2025-05-01 (300km/20L) qualify
    const r = sinceLastServiceMileage(entries, services);
    expect(r.totalKm).toBe(700);
    expect(r.totalLitres).toBe(45);
    expect(r.kmPerLitre).toBeCloseTo(700 / 45, 6);
  });

  it('is null when the last service is after every fuel interval', () => {
    const services = [service({ servicedAt: '2025-06-01T00:00:00.000Z' })];
    expect(sinceLastServiceMileage(entries, services).kmPerLitre).toBeNull();
  });

  it('counts a fill logged on the SAME DAY as the service (service assumed first)', () => {
    const sameDayEntries = [
      fuel({ odometerKm: 0, litresFilled: 10, filledAt: localIso(2025, 7, 1, 0) }),
      // filled later in the day, after the service that morning
      fuel({ odometerKm: 300, litresFilled: 15, filledAt: localIso(2025, 7, 10, 20) }),
    ];
    const services = [service({ servicedAt: localIso(2025, 7, 10, 8) })];
    const r = sinceLastServiceMileage(sameDayEntries, services);
    expect(r.totalKm).toBe(300);
    expect(r.totalLitres).toBe(10);
  });
});
