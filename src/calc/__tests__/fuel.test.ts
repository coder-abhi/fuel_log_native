import {
  currentOdometer,
  estimateRemainingFuel,
  latestFullTank,
} from '../fuel';
import { checkin, fuel, service, vehicle, resetIds } from './helpers';

beforeEach(resetIds);

describe('currentOdometer', () => {
  it('picks the latest reading across fuel entries and check-ins', () => {
    const r = currentOdometer(
      [fuel({ odometerKm: 1000, filledAt: '2025-01-01T00:00:00.000Z' })],
      [checkin({ odometerKm: 1234, checkedAt: '2025-01-05T00:00:00.000Z' })],
    );
    expect(r).toEqual({ odometerKm: 1234, at: '2025-01-05T00:00:00.000Z' });
  });

  it('returns null with no readings', () => {
    expect(currentOdometer([], [])).toBeNull();
  });
});

describe('latestFullTank', () => {
  it('returns the most recent full-tank fill', () => {
    const f1 = fuel({ isFullTank: true, filledAt: '2025-01-01T00:00:00.000Z' });
    const f2 = fuel({ isFullTank: false, filledAt: '2025-01-10T00:00:00.000Z' });
    const f3 = fuel({ isFullTank: true, filledAt: '2025-01-08T00:00:00.000Z' });
    expect(latestFullTank([f1, f2, f3])?.filledAt).toBe('2025-01-08T00:00:00.000Z');
  });

  it('returns null when there is no full-tank fill', () => {
    expect(latestFullTank([fuel({ isFullTank: false })])).toBeNull();
  });
});

describe('estimateRemainingFuel', () => {
  it('skips estimation gracefully when there is no full-tank fill ever', () => {
    const r = estimateRemainingFuel({
      vehicle: vehicle(),
      fuelEntries: [
        fuel({ odometerKm: 0, litresFilled: 10, filledAt: '2025-01-01T00:00:00.000Z' }),
        fuel({ odometerKm: 400, litresFilled: 10, filledAt: '2025-01-05T00:00:00.000Z' }),
      ],
      odometerCheckins: [],
      services: [],
    });
    expect(r.canEstimate).toBe(false);
    expect(r.reason).toBe('no-full-tank');
    expect(r.remainingLitres).toBeNull();
  });

  it('returns no-readings when there is no odometer data at all', () => {
    const r = estimateRemainingFuel({
      vehicle: vehicle(),
      fuelEntries: [],
      odometerCheckins: [],
      services: [],
    });
    expect(r.reason).toBe('no-readings');
  });

  it('falls back to a rough per-type mileage when no usable interval exists yet', () => {
    const r = estimateRemainingFuel({
      vehicle: vehicle({ type: 'bike', tankCapacityLitres: 40 }),
      fuelEntries: [
        fuel({ odometerKm: 100, litresFilled: 40, isFullTank: true, filledAt: '2025-01-01T00:00:00.000Z' }),
      ],
      odometerCheckins: [checkin({ odometerKm: 135, checkedAt: '2025-01-02T00:00:00.000Z' })],
      services: [],
    });
    // bike rough mileage = 35 km/l; 35 km since full => 1 L consumed => 39 L left.
    expect(r.canEstimate).toBe(true);
    expect(r.mileageUsed).toBeNull(); // the rough figure is never surfaced
    expect(r.remainingLitres).toBeCloseTo(39, 6);
    expect(r.estimatedRangeKm).toBeCloseTo(39 * 35, 6);
  });

  it('estimates remaining litres and range from the last full tank', () => {
    // Build a since-last-service mileage of 20 km/l:
    //   full tank @0km, then fill @1000km with 50L  -> 1000km / 50L = 20 km/l
    const v = vehicle({ tankCapacityLitres: 40, reserveThresholdLitres: 4 });
    const fuelEntries = [
      fuel({ odometerKm: 0, litresFilled: 40, isFullTank: true, filledAt: '2025-01-01T00:00:00.000Z' }),
      fuel({ odometerKm: 1000, litresFilled: 50, isFullTank: true, filledAt: '2025-02-01T00:00:00.000Z' }),
    ];
    // current odometer via a check-in 100 km after the last full tank
    const odometerCheckins = [
      checkin({ odometerKm: 1100, checkedAt: '2025-02-03T00:00:00.000Z' }),
    ];
    const r = estimateRemainingFuel({ vehicle: v, fuelEntries, odometerCheckins, services: [] });
    // baseline = full tank @1000km (the most recent). kmSinceFull = 100.
    // mileage = 20 km/l -> consumed = 5 L. no partial fills after baseline.
    // estimatedFuel = 40 - 5 + 0 = 35
    expect(r.canEstimate).toBe(true);
    expect(r.mileageUsed).toBeCloseTo(20, 6);
    expect(r.remainingLitres).toBeCloseTo(35, 6);
    expect(r.estimatedRangeKm).toBeCloseTo(700, 6);
    expect(r.atOrBelowReserve).toBe(false);
  });

  it('adds partial top-ups made after the baseline full tank', () => {
    const v = vehicle({ tankCapacityLitres: 40 });
    const fuelEntries = [
      fuel({ odometerKm: 0, litresFilled: 40, isFullTank: true, filledAt: '2025-01-01T00:00:00.000Z' }),
      fuel({ odometerKm: 1000, litresFilled: 50, isFullTank: true, filledAt: '2025-02-01T00:00:00.000Z' }), // sets 20km/l
      fuel({ odometerKm: 1200, litresFilled: 6, isFullTank: false, filledAt: '2025-02-04T00:00:00.000Z' }), // partial after baseline
    ];
    const r = estimateRemainingFuel({
      vehicle: v,
      fuelEntries,
      odometerCheckins: [checkin({ odometerKm: 1300, checkedAt: '2025-02-05T00:00:00.000Z' })],
      services: [],
    });
    // lifetime mileage here = 1200 km / 56 L (the 6 L partial is in the sums too).
    // baseline = @1000km full tank. kmSinceFull = 300 -> consumed 300 * 56/1200 = 14 L.
    // partial 6 L added after baseline. estimatedFuel = 40 - 14 + 6 = 32
    expect(r.remainingLitres).toBeCloseTo(32, 6);
  });

  it('clamps remaining litres into [0, tankCapacity]', () => {
    const v = vehicle({ tankCapacityLitres: 40, reserveThresholdLitres: 4 });
    const fuelEntries = [
      fuel({ odometerKm: 0, litresFilled: 40, isFullTank: true, filledAt: '2025-01-01T00:00:00.000Z' }),
      fuel({ odometerKm: 500, litresFilled: 50, isFullTank: true, filledAt: '2025-02-01T00:00:00.000Z' }), // 10 km/l
    ];
    const r = estimateRemainingFuel({
      vehicle: v,
      fuelEntries,
      // 900 km past the last full tank at 10 km/l => -50 L before clamping
      odometerCheckins: [checkin({ odometerKm: 1400, checkedAt: '2025-03-01T00:00:00.000Z' })],
      services: [],
    });
    expect(r.remainingLitres).toBe(0);
    expect(r.estimatedRangeKm).toBe(0);
    expect(r.atOrBelowReserve).toBe(true);
  });

  it('flags atOrBelowReserve when the estimate dips to the threshold', () => {
    const v = vehicle({ tankCapacityLitres: 40, reserveThresholdLitres: 8 });
    const fuelEntries = [
      fuel({ odometerKm: 0, litresFilled: 40, isFullTank: true, filledAt: '2025-01-01T00:00:00.000Z' }),
      fuel({ odometerKm: 800, litresFilled: 40, isFullTank: true, filledAt: '2025-02-01T00:00:00.000Z' }), // 20 km/l
    ];
    const r = estimateRemainingFuel({
      vehicle: v,
      fuelEntries,
      // 640 km past last full tank @ 20km/l => 32 L consumed => 8 L left
      odometerCheckins: [checkin({ odometerKm: 1440, checkedAt: '2025-02-20T00:00:00.000Z' })],
      services: [],
    });
    expect(r.remainingLitres).toBeCloseTo(8, 6);
    expect(r.atOrBelowReserve).toBe(true);
  });

  it('uses since-last-service mileage, not lifetime', () => {
    const v = vehicle({ tankCapacityLitres: 50 });
    const fuelEntries = [
      // pre-service: very thirsty 10 km/l
      fuel({ odometerKm: 0, litresFilled: 50, isFullTank: true, filledAt: '2025-01-01T00:00:00.000Z' }),
      fuel({ odometerKm: 500, litresFilled: 50, isFullTank: true, filledAt: '2025-02-01T00:00:00.000Z' }),
      // post-service: efficient 25 km/l
      fuel({ odometerKm: 1500, litresFilled: 40, isFullTank: true, filledAt: '2025-04-01T00:00:00.000Z' }),
    ];
    const services = [service({ servicedAt: '2025-03-01T00:00:00.000Z' })];
    const r = estimateRemainingFuel({
      vehicle: v,
      fuelEntries,
      odometerCheckins: [checkin({ odometerKm: 1750, checkedAt: '2025-04-05T00:00:00.000Z' })],
      services,
    });
    // since-last-service mileage = 1000km / 40L = 25 km/l
    expect(r.mileageUsed).toBeCloseTo(25, 6);
    // baseline full tank @1500km, kmSinceFull 250 => 10 L consumed => 40 L left
    expect(r.remainingLitres).toBeCloseTo(40, 6);
  });
});
