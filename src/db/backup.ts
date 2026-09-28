/**
 * Whole-database snapshot used by the JSON backup/restore feature.
 *
 * Restoring preserves the original row ids (vehicles are referenced by id from
 * fuel_entries / odometer_checkins / service_records), so a restored backup
 * comes back with its relations intact instead of being re-keyed.
 */

import type { FuelEntry, OdometerCheckin, ServiceRecord, Vehicle } from '@/calc';

import { boolToInt, getDb } from './client';
import { listAllFuelEntries } from './fuelEntries';
import { listAllCheckins } from './odometerCheckins';
import { listAllServiceRecords } from './serviceRecords';
import { listVehicles } from './vehicles';

export interface BackupSnapshot {
  vehicles: Vehicle[];
  fuelEntries: FuelEntry[];
  checkins: OdometerCheckin[];
  services: ServiceRecord[];
}

export async function exportSnapshot(): Promise<BackupSnapshot> {
  const [vehicles, fuelEntries, checkins, services] = await Promise.all([
    listVehicles(),
    listAllFuelEntries(),
    listAllCheckins(),
    listAllServiceRecords(),
  ]);
  return { vehicles, fuelEntries, checkins, services };
}

/** Wipes all existing data and replaces it with the snapshot, id-for-id. */
export async function importSnapshot(snapshot: BackupSnapshot): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM fuel_entries;
      DELETE FROM odometer_checkins;
      DELETE FROM service_records;
      DELETE FROM vehicles;
    `);

    for (const v of snapshot.vehicles) {
      await db.runAsync(
        `INSERT INTO vehicles (id, name, type, tank_capacity_litres, reserve_threshold_litres, created_at)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [v.id, v.name, v.type, v.tankCapacityLitres, v.reserveThresholdLitres, v.createdAt],
      );
    }
    for (const f of snapshot.fuelEntries) {
      await db.runAsync(
        `INSERT INTO fuel_entries
          (id, vehicle_id, odometer_km, litres_filled, is_full_tank, is_approximate,
           excluded_from_mileage, cost, filled_at, created_at, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          f.id,
          f.vehicleId,
          f.odometerKm,
          f.litresFilled,
          boolToInt(f.isFullTank),
          boolToInt(f.isApproximate),
          boolToInt(f.excludedFromMileage),
          f.cost,
          f.filledAt,
          f.createdAt,
          f.notes,
        ],
      );
    }
    for (const c of snapshot.checkins) {
      await db.runAsync(
        `INSERT INTO odometer_checkins (id, vehicle_id, odometer_km, checked_at, created_at, notes, fuel_percent)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [c.id, c.vehicleId, c.odometerKm, c.checkedAt, c.createdAt, c.notes, c.fuelPercent],
      );
    }
    for (const s of snapshot.services) {
      await db.runAsync(
        `INSERT INTO service_records (id, vehicle_id, odometer_km, serviced_at, cost, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [s.id, s.vehicleId, s.odometerKm, s.servicedAt, s.cost, s.notes, s.createdAt],
      );
    }
  });
}
