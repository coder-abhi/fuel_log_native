import type { FuelEntry } from '@/calc';

import { boolToInt, getDb, intToBool, nowIso } from './client';

interface FuelRow {
  id: number;
  vehicle_id: number;
  odometer_km: number;
  litres_filled: number | null;
  is_full_tank: number;
  is_approximate: number;
  excluded_from_mileage: number;
  cost: number | null;
  filled_at: string;
  created_at: string;
  notes: string | null;
}

const mapRow = (r: FuelRow): FuelEntry => ({
  id: r.id,
  vehicleId: r.vehicle_id,
  odometerKm: r.odometer_km,
  litresFilled: r.litres_filled,
  isFullTank: intToBool(r.is_full_tank),
  isApproximate: intToBool(r.is_approximate),
  excludedFromMileage: intToBool(r.excluded_from_mileage),
  cost: r.cost,
  filledAt: r.filled_at,
  createdAt: r.created_at,
  notes: r.notes,
});

export interface FuelEntryInput {
  vehicleId: number;
  odometerKm: number;
  litresFilled: number | null;
  isFullTank: boolean;
  isApproximate: boolean;
  excludedFromMileage: boolean;
  cost: number | null;
  filledAt: string;
  notes: string | null;
}

export async function listFuelEntries(vehicleId: number): Promise<FuelEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<FuelRow>(
    'SELECT * FROM fuel_entries WHERE vehicle_id = ? ORDER BY filled_at ASC, created_at ASC, id ASC;',
    [vehicleId],
  );
  return rows.map(mapRow);
}

export async function createFuelEntry(input: FuelEntryInput): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    `INSERT INTO fuel_entries
      (vehicle_id, odometer_km, litres_filled, is_full_tank, is_approximate,
       excluded_from_mileage, cost, filled_at, created_at, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      input.vehicleId,
      input.odometerKm,
      input.litresFilled,
      boolToInt(input.isFullTank),
      boolToInt(input.isApproximate),
      boolToInt(input.excludedFromMileage),
      input.cost,
      input.filledAt,
      nowIso(),
      input.notes,
    ],
  );
  return res.lastInsertRowId;
}

export async function updateFuelEntry(id: number, input: FuelEntryInput): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE fuel_entries SET
       odometer_km = ?, litres_filled = ?, is_full_tank = ?, is_approximate = ?,
       excluded_from_mileage = ?, cost = ?, filled_at = ?, notes = ?
     WHERE id = ?;`,
    [
      input.odometerKm,
      input.litresFilled,
      boolToInt(input.isFullTank),
      boolToInt(input.isApproximate),
      boolToInt(input.excludedFromMileage),
      input.cost,
      input.filledAt,
      input.notes,
      id,
    ],
  );
}

export async function deleteFuelEntry(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM fuel_entries WHERE id = ?;', [id]);
}
