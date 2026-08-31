import { mileageTrendPoints } from '../trend';
import { fuel, resetIds } from './helpers';

beforeEach(resetIds);

describe('mileageTrendPoints', () => {
  it('emits one running-average point per counted interval', () => {
    const entries = [
      fuel({ odometerKm: 0, litresFilled: 10, filledAt: '2025-01-01T00:00:00.000Z' }),
      fuel({ odometerKm: 200, litresFilled: 10, filledAt: '2025-01-05T00:00:00.000Z' }),
      fuel({ odometerKm: 500, litresFilled: 10, filledAt: '2025-01-10T00:00:00.000Z' }),
    ];
    const pts = mileageTrendPoints(entries);
    expect(pts).toHaveLength(2);
    expect(pts[0].kmPerLitre).toBeCloseTo(200 / 10, 6);
    expect(pts[1].kmPerLitre).toBeCloseTo(500 / 20, 6);
    expect(pts[1].at).toBe('2025-01-10T00:00:00.000Z');
  });

  it('skips excluded intervals', () => {
    const entries = [
      fuel({ odometerKm: 0, litresFilled: 10, filledAt: '2025-01-01T00:00:00.000Z' }),
      fuel({
        odometerKm: 400,
        litresFilled: null,
        excludedFromMileage: true,
        filledAt: '2025-01-05T00:00:00.000Z',
      }),
      fuel({ odometerKm: 700, litresFilled: 15, filledAt: '2025-01-10T00:00:00.000Z' }),
    ];
    const pts = mileageTrendPoints(entries);
    expect(pts).toHaveLength(1);
    expect(pts[0].kmPerLitre).toBeCloseTo(300 / 15, 6);
  });

  it('is empty with fewer than two entries', () => {
    expect(mileageTrendPoints([])).toEqual([]);
    expect(mileageTrendPoints([fuel({ odometerKm: 1, litresFilled: 1 })])).toEqual([]);
  });
});
