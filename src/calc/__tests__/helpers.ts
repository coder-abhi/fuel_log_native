import type { FuelEntry, OdometerCheckin, ServiceRecord, Vehicle } from '../types';

let seq = 1;
export const nextId = () => seq++;
export const resetIds = () => {
  seq = 1;
};

export function vehicle(over: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 1,
    name: 'Test',
    type: 'bike',
    tankCapacityLitres: 40,
    reserveThresholdLitres: 4,
    createdAt: '2024-01-01T00:00:00.000Z',
    ...over,
  };
}

export function fuel(over: Partial<FuelEntry> = {}): FuelEntry {
  const id = over.id ?? nextId();
  return {
    id,
    vehicleId: 1,
    odometerKm: 0,
    litresFilled: 0,
    isFullTank: false,
    isApproximate: false,
    excludedFromMileage: false,
    cost: null,
    filledAt: '2025-01-01T00:00:00.000Z',
    createdAt: '2025-01-01T00:00:00.000Z',
    notes: null,
    ...over,
  };
}

export function checkin(over: Partial<OdometerCheckin> = {}): OdometerCheckin {
  const id = over.id ?? nextId();
  return {
    id,
    vehicleId: 1,
    odometerKm: 0,
    checkedAt: '2025-01-01T00:00:00.000Z',
    createdAt: '2025-01-01T00:00:00.000Z',
    notes: null,
    fuelPercent: null,
    ...over,
  };
}

export function service(over: Partial<ServiceRecord> = {}): ServiceRecord {
  const id = over.id ?? nextId();
  return {
    id,
    vehicleId: 1,
    odometerKm: 0,
    servicedAt: '2025-01-01T00:00:00.000Z',
    cost: null,
    notes: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    ...over,
  };
}

/** local-time ISO string, so period tests are stable regardless of TZ */
export function localIso(y: number, m: number, d: number, h = 12, min = 0): string {
  return new Date(y, m - 1, d, h, min, 0, 0).toISOString();
}
