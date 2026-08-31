/**
 * Domain types for the pure calculation layer.
 *
 * These are intentionally free of any React / React Native / expo-sqlite types.
 * The DAO layer is responsible for mapping database rows (snake_case, 0/1 ints,
 * text timestamps) into these shapes.
 *
 * All timestamps are ISO-8601 strings (e.g. "2025-04-12T08:15:00.000Z").
 */

/** Broad vehicle class — drives the bootstrap mileage fallback only. */
export type VehicleType = 'bike' | 'car' | 'scooty';

export interface Vehicle {
  id: number;
  name: string;
  type: VehicleType;
  tankCapacityLitres: number;
  reserveThresholdLitres: number;
  createdAt: string;
}

export interface FuelEntry {
  id: number;
  vehicleId: number;
  odometerKm: number;
  /** null only when the entry is an excluded / "not sure" missed-fill marker. */
  litresFilled: number | null;
  isFullTank: boolean;
  /** litres were a rough estimate for a forgotten fill — still used in mileage math. */
  isApproximate: boolean;
  /** the interval ENDING at this entry is skipped by mileage math (distance still counts). */
  excludedFromMileage: boolean;
  cost: number | null;
  /** user-selected moment the fill happened (not necessarily row creation time). */
  filledAt: string;
  createdAt: string;
  notes: string | null;
}

export interface OdometerCheckin {
  id: number;
  vehicleId: number;
  odometerKm: number;
  checkedAt: string;
  createdAt: string;
  notes: string | null;
}

export interface ServiceRecord {
  id: number;
  vehicleId: number;
  /** null when the user logged only a service date (odometer is optional). */
  odometerKm: number | null;
  servicedAt: string;
  cost: number | null;
  notes: string | null;
  createdAt: string;
}

/** A single reading on the combined odometer timeline (fuel fills + check-ins). */
export interface OdometerReading {
  odometerKm: number;
  at: string;
  source: 'fuel' | 'checkin';
  sourceId: number;
}
