import { serviceIntervalBuckets } from '../serviceIntervals';
import { fuel, service, resetIds, localIso } from './helpers';

beforeEach(resetIds);

describe('serviceIntervalBuckets', () => {
  it('single ongoing bucket when there are no service records', () => {
    const entries = [
      fuel({ odometerKm: 0, litresFilled: 10, filledAt: '2025-01-01T00:00:00.000Z' }),
      fuel({ odometerKm: 500, litresFilled: 25, filledAt: '2025-01-10T00:00:00.000Z' }),
    ];
    const b = serviceIntervalBuckets(entries, []);
    expect(b).toHaveLength(1);
    expect(b[0].ongoing).toBe(true);
    // litres come from the earlier (0km) fill, not the later (500km) one.
    expect(b[0].kmPerLitre).toBeCloseTo(500 / 10, 6);
  });

  it('partitions intervals by service boundaries with an ongoing last bucket', () => {
    const entries = [
      fuel({ odometerKm: 0, litresFilled: 10, filledAt: '2025-01-01T00:00:00.000Z' }),
      fuel({ odometerKm: 400, litresFilled: 20, filledAt: '2025-02-01T00:00:00.000Z' }), // bucket 0
      fuel({ odometerKm: 900, litresFilled: 25, filledAt: '2025-04-01T00:00:00.000Z' }), // bucket 1
      fuel({ odometerKm: 1500, litresFilled: 30, filledAt: '2025-06-01T00:00:00.000Z' }), // bucket 2 (ongoing)
    ];
    const services = [
      service({ servicedAt: '2025-03-01T00:00:00.000Z' }),
      service({ servicedAt: '2025-05-01T00:00:00.000Z' }),
    ];
    const b = serviceIntervalBuckets(entries, services);
    expect(b).toHaveLength(3);

    expect(b[0].startAt).toBeNull();
    expect(b[0].totalKm).toBe(400);
    expect(b[0].totalLitres).toBe(10); // earlier (0km) fill's litres

    expect(b[1].ongoing).toBe(false);
    expect(b[1].totalKm).toBe(500);
    expect(b[1].totalLitres).toBe(20); // earlier (400km) fill's litres

    expect(b[2].ongoing).toBe(true);
    expect(b[2].endAt).toBeNull();
    expect(b[2].totalKm).toBe(600);
    expect(b[2].totalLitres).toBe(25); // earlier (900km) fill's litres
  });

  it('an interval on the SAME DAY as a service belongs to the bucket that opens with it', () => {
    // The service is assumed to have happened first, then the tank got filled
    // later the same day — so this interval counts as post-service, not pre.
    const entries = [
      fuel({ odometerKm: 0, litresFilled: 10, filledAt: localIso(2025, 1, 1, 0) }),
      fuel({ odometerKm: 300, litresFilled: 15, filledAt: localIso(2025, 2, 1, 18) }),
    ];
    const services = [service({ servicedAt: localIso(2025, 2, 1, 8) })];
    const b = serviceIntervalBuckets(entries, services);
    expect(b).toHaveLength(2);
    expect(b[0].totalKm).toBe(0);
    expect(b[0].kmPerLitre).toBeNull();
    expect(b[1].ongoing).toBe(true);
    expect(b[1].totalKm).toBe(300);
    expect(b[1].totalLitres).toBe(10);
  });

  it('excluded intervals do not contribute to their bucket', () => {
    const entries = [
      fuel({ odometerKm: 0, litresFilled: 10, filledAt: '2025-01-01T00:00:00.000Z' }),
      fuel({
        odometerKm: 700,
        litresFilled: null,
        excludedFromMileage: true,
        filledAt: '2025-01-20T00:00:00.000Z',
      }),
      fuel({ odometerKm: 1000, litresFilled: 15, filledAt: '2025-02-05T00:00:00.000Z' }),
    ];
    const b = serviceIntervalBuckets(entries, []);
    expect(b[0].totalKm).toBe(300);
    expect(b[0].totalLitres).toBe(15);
  });
});
