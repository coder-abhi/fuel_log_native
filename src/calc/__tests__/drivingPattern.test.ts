import {
  buildDrivingIntervals,
  buildOdometerTimeline,
  drivingPatternStats,
} from '../drivingPattern';
import { checkin, fuel, localIso, resetIds } from './helpers';

beforeEach(resetIds);

describe('buildOdometerTimeline', () => {
  it('merges fuel + check-in readings in chronological order', () => {
    const timeline = buildOdometerTimeline(
      [
        fuel({ odometerKm: 100, filledAt: '2025-01-03T00:00:00.000Z' }),
        fuel({ odometerKm: 300, filledAt: '2025-01-10T00:00:00.000Z' }),
      ],
      [
        checkin({ odometerKm: 200, checkedAt: '2025-01-06T00:00:00.000Z' }),
        checkin({ odometerKm: 50, checkedAt: '2025-01-01T00:00:00.000Z' }),
      ],
    );
    expect(timeline.map((r) => r.odometerKm)).toEqual([50, 100, 200, 300]);
    expect(timeline.map((r) => r.source)).toEqual(['checkin', 'fuel', 'checkin', 'fuel']);
  });
});

describe('buildDrivingIntervals', () => {
  it('drops non-positive deltas and computes the midpoint', () => {
    const timeline = buildOdometerTimeline(
      [
        fuel({ odometerKm: 100, filledAt: localIso(2025, 4, 1) }),
        fuel({ odometerKm: 90, filledAt: localIso(2025, 4, 2) }), // odo went backwards
        fuel({ odometerKm: 300, filledAt: localIso(2025, 4, 5) }),
      ],
      [],
    );
    const ivs = buildDrivingIntervals(timeline);
    // the backwards reading (90) is left on the timeline; the negative interval
    // 100 -> 90 is dropped, and the next interval is measured from 90 -> 300.
    expect(ivs).toHaveLength(1);
    expect(ivs[0].deltaKm).toBe(210);
  });
});

describe('drivingPatternStats', () => {
  // now = Tue 15 Apr 2025; week starts Monday => current week is 14–20 Apr.
  const now = new Date(2025, 3, 15, 9, 0, 0);

  const fuelEntries = [
    fuel({ odometerKm: 1000, filledAt: localIso(2025, 4, 1, 12) }),
    fuel({ odometerKm: 1500, filledAt: localIso(2025, 4, 12, 12) }),
  ];
  const odometerCheckins = [
    checkin({ odometerKm: 1210, checkedAt: localIso(2025, 4, 5, 12) }),
    checkin({ odometerKm: 1600, checkedAt: localIso(2025, 4, 15, 12) }),
    checkin({ odometerKm: 1700, checkedAt: localIso(2025, 4, 19, 12) }),
    checkin({ odometerKm: 1750, checkedAt: localIso(2025, 4, 21, 12) }),
  ];

  it('sums km driven this month by interval midpoint', () => {
    const s = drivingPatternStats({ fuelEntries, odometerCheckins, now });
    // intervals: 210, 290, 100, 100, 50  (all midpoints land in April)
    expect(s.kmThisMonth).toBe(750);
    expect(s.intervalCount).toBe(5);
  });

  it('sums km driven this week by interval midpoint', () => {
    const s = drivingPatternStats({ fuelEntries, odometerCheckins, now });
    // midpoints in 14–20 Apr: 100 (mid 14 Apr) + 100 (mid 17 Apr) + 50 (mid 20 Apr)
    expect(s.kmThisWeek).toBe(250);
  });

  it('splits weekday vs weekend averages by midpoint day-of-week', () => {
    const s = drivingPatternStats({ fuelEntries, odometerCheckins, now });
    // weekday midpoint deltas: 210, 290, 100, 100 => mean 175
    // weekend midpoint deltas: 50 (Sunday 20 Apr) => mean 50
    expect(s.weekdayAvgKm).toBeCloseTo(175, 6);
    expect(s.weekendAvgKm).toBeCloseTo(50, 6);
  });

  it('buckets this-month km by weekday (0=Mon..6=Sun)', () => {
    const s = drivingPatternStats({ fuelEntries, odometerCheckins, now });
    expect(s.kmByWeekday).toEqual([100, 0, 290, 310, 0, 0, 50]);
  });

  it('returns null averages when a bucket has no intervals', () => {
    const s = drivingPatternStats({
      fuelEntries: [
        fuel({ odometerKm: 0, filledAt: localIso(2025, 4, 7, 12) }), // Monday
        fuel({ odometerKm: 100, filledAt: localIso(2025, 4, 9, 12) }), // midpoint Tue 8 Apr
      ],
      odometerCheckins: [],
      now,
    });
    expect(s.weekdayAvgKm).toBeCloseTo(100, 6);
    expect(s.weekendAvgKm).toBeNull();
  });

  it('counts distance from intervals even when a fuel entry is excluded from mileage', () => {
    const s = drivingPatternStats({
      fuelEntries: [
        fuel({ odometerKm: 0, filledAt: localIso(2025, 4, 2, 12) }),
        fuel({
          odometerKm: 400,
          litresFilled: null,
          excludedFromMileage: true,
          filledAt: localIso(2025, 4, 6, 12),
        }),
      ],
      odometerCheckins: [],
      now,
    });
    expect(s.kmThisMonth).toBe(400);
  });

  it('supports a Sunday week start', () => {
    // now Tue 15 Apr; Sunday-start week is 13–19 Apr
    const s = drivingPatternStats({ fuelEntries, odometerCheckins, now, weekStartsOn: 0 });
    // adds the interval with midpoint 14 Apr and 17 Apr; excludes midpoint 20 Apr (next week)
    expect(s.kmThisWeek).toBe(200);
  });
});
