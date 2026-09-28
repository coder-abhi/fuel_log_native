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
    // Build a since-last-service mileage of 25 km/l:
    //   full tank @0km with 40L, then fill @1000km -> the 0km fill's 40L
    //   explains the 1000km covered to get here -> 1000km / 40L = 25 km/l
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
    // mileage = 25 km/l -> consumed = 4 L. no partial fills after baseline.
    // estimatedFuel = 40 - 4 + 0 = 36
    expect(r.canEstimate).toBe(true);
    expect(r.mileageUsed).toBeCloseTo(25, 6);
    expect(r.remainingLitres).toBeCloseTo(36, 6);
    expect(r.estimatedRangeKm).toBeCloseTo(900, 6);
    expect(r.atOrBelowReserve).toBe(false);
  });

  it('adds partial top-ups made after the baseline full tank', () => {
    const v = vehicle({ tankCapacityLitres: 40 });
    const fuelEntries = [
      fuel({ odometerKm: 0, litresFilled: 40, isFullTank: true, filledAt: '2025-01-01T00:00:00.000Z' }),
      fuel({ odometerKm: 1000, litresFilled: 50, isFullTank: true, filledAt: '2025-02-01T00:00:00.000Z' }),
      fuel({ odometerKm: 1200, litresFilled: 6, isFullTank: false, filledAt: '2025-02-04T00:00:00.000Z' }), // partial after baseline
    ];
    const r = estimateRemainingFuel({
      vehicle: v,
      fuelEntries,
      odometerCheckins: [checkin({ odometerKm: 1300, checkedAt: '2025-02-05T00:00:00.000Z' })],
      services: [],
    });
    // lifetime mileage here = 1200 km / 90 L (0km fill's 40L covers 0->1000,
    // 1000km fill's 50L covers 1000->1200; the 1200km entry's own 6L isn't
    // counted yet — nothing closes that interval).
    // baseline = @1000km full tank. kmSinceFull = 300 -> consumed 300 * 90/1200 = 22.5 L.
    // partial 6 L added after baseline. estimatedFuel = 40 - 22.5 + 6 = 23.5
    expect(r.remainingLitres).toBeCloseTo(23.5, 6);
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
    // since-last-service mileage: only interval 500->1500 qualifies, and its
    // litres come from the earlier (500km) fill: 1000km / 50L = 20 km/l
    expect(r.mileageUsed).toBeCloseTo(20, 6);
    // baseline full tank @1500km, kmSinceFull 250 => 12.5 L consumed => 37.5 L left
    expect(r.remainingLitres).toBeCloseTo(37.5, 6);
  });

  describe('reconciling a fuel-level check-in against the calculated figure', () => {
    it('splits the difference and re-derives the mileage used for range', () => {
      const v = vehicle({ tankCapacityLitres: 10, reserveThresholdLitres: 1 });
      const fuelEntries = [
        fuel({ odometerKm: 0, litresFilled: 5, isFullTank: true, filledAt: '2025-01-01T00:00:00.000Z' }),
        fuel({ odometerKm: 100, litresFilled: 5, isFullTank: true, filledAt: '2025-01-08T00:00:00.000Z' }),
      ];
      // calc says: mileage 100km/5L = 20 km/l, 50km since full @20km/l => 2.5L
      // consumed => 7.5L left. But the user glanced at the gauge and guessed
      // only 10% (1L) remains — a big contradiction.
      const r = estimateRemainingFuel({
        vehicle: v,
        fuelEntries,
        odometerCheckins: [
          checkin({ odometerKm: 150, checkedAt: '2025-01-10T00:00:00.000Z', fuelPercent: 10 }),
        ],
        services: [],
      });
      // (7.5 calc + 1 observed) / 2 = 4.25L
      expect(r.remainingLitres).toBeCloseTo(4.25, 6);
      // implied consumption since full: 10 - 4.25 = 5.75L over 50km => ~8.70 km/l,
      // well below the raw 20 km/l — the reconciliation makes mileage WORSE,
      // consistent with believing more fuel was actually burned.
      expect(r.mileageUsed).toBeCloseTo(50 / 5.75, 6);
      expect(r.mileageUsed!).toBeLessThan(20);
      expect(r.estimatedRangeKm).toBeCloseTo(4.25 * (50 / 5.75), 6);
    });

    it('ignores a fuel-level guess that is no longer the current reading', () => {
      const v = vehicle({ tankCapacityLitres: 10, reserveThresholdLitres: 1 });
      const fuelEntries = [
        fuel({ odometerKm: 0, litresFilled: 5, isFullTank: true, filledAt: '2025-01-01T00:00:00.000Z' }),
        fuel({ odometerKm: 100, litresFilled: 5, isFullTank: true, filledAt: '2025-01-08T00:00:00.000Z' }),
      ];
      const r = estimateRemainingFuel({
        vehicle: v,
        fuelEntries,
        odometerCheckins: [
          // a stale fuel-level guess, superseded by a later plain check-in
          checkin({ odometerKm: 120, checkedAt: '2025-01-09T00:00:00.000Z', fuelPercent: 10 }),
          checkin({ odometerKm: 150, checkedAt: '2025-01-10T00:00:00.000Z', fuelPercent: null }),
        ],
        services: [],
      });
      // unaffected by the stale 10% guess — pure calc figure, same as the
      // "estimates remaining litres" style tests above.
      expect(r.mileageUsed).toBeCloseTo(20, 6);
      expect(r.remainingLitres).toBeCloseTo(7.5, 6);
    });
  });
});
