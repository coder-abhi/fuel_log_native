import { nearestOdometerNeighbors, odometerOrderViolation } from '../odometerGuard';

describe('nearestOdometerNeighbors', () => {
  const points = [
    { at: '2025-01-01T00:00:00.000Z', odometerKm: 100 },
    { at: '2025-01-10T00:00:00.000Z', odometerKm: 500 },
    { at: '2025-01-20T00:00:00.000Z', odometerKm: 900 },
  ];

  it('finds the reading immediately before and after a mid-history timestamp', () => {
    const n = nearestOdometerNeighbors(points, '2025-01-15T00:00:00.000Z');
    expect(n.prev?.odometerKm).toBe(500);
    expect(n.next?.odometerKm).toBe(900);
  });

  it('has no next when at is after every point', () => {
    const n = nearestOdometerNeighbors(points, '2025-02-01T00:00:00.000Z');
    expect(n.prev?.odometerKm).toBe(900);
    expect(n.next).toBeNull();
  });

  it('has no prev when at is before every point', () => {
    const n = nearestOdometerNeighbors(points, '2024-12-01T00:00:00.000Z');
    expect(n.prev).toBeNull();
    expect(n.next?.odometerKm).toBe(100);
  });

  it('treats an identical timestamp as "before" (a tie goes to prev)', () => {
    const n = nearestOdometerNeighbors(points, '2025-01-10T00:00:00.000Z');
    expect(n.prev?.odometerKm).toBe(500);
    expect(n.next?.odometerKm).toBe(900);
  });
});

describe('odometerOrderViolation', () => {
  it('flags a reading lower than the earlier neighbor', () => {
    const v = odometerOrderViolation(400, {
      prev: { at: '2025-01-01T00:00:00.000Z', odometerKm: 500 },
      next: null,
    });
    expect(v).toBe('below-earlier');
  });

  it('flags a reading higher than the later neighbor (e.g. a backdated entry)', () => {
    const v = odometerOrderViolation(950, {
      prev: null,
      next: { at: '2025-01-20T00:00:00.000Z', odometerKm: 900 },
    });
    expect(v).toBe('above-later');
  });

  it('accepts a reading that fits between both neighbors', () => {
    const v = odometerOrderViolation(700, {
      prev: { at: '2025-01-10T00:00:00.000Z', odometerKm: 500 },
      next: { at: '2025-01-20T00:00:00.000Z', odometerKm: 900 },
    });
    expect(v).toBeNull();
  });

  it('accepts anything with no neighbors at all', () => {
    expect(odometerOrderViolation(0, { prev: null, next: null })).toBeNull();
  });
});
