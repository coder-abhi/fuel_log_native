import type { Vehicle, VehicleType } from '@/calc';

import { getDb, nowIso } from './client';

interface VehicleRow {
  id: number;
  name: string;
  type: string;
  tank_capacity_litres: number;
  reserve_threshold_litres: number;
  created_at: string;
}

const mapRow = (r: VehicleRow): Vehicle => ({
  id: r.id,
  name: r.name,
  type: (r.type as VehicleType) ?? 'bike',
  tankCapacityLitres: r.tank_capacity_litres,
  reserveThresholdLitres: r.reserve_threshold_litres,
  createdAt: r.created_at,
});

export interface VehicleInput {
  name: string;
  type: VehicleType;
  tankCapacityLitres: number;
  reserveThresholdLitres: number;
}

export async function listVehicles(): Promise<Vehicle[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<VehicleRow>(
    'SELECT * FROM vehicles ORDER BY created_at ASC, id ASC;',
  );
  return rows.map(mapRow);
}

export async function getVehicle(id: number): Promise<Vehicle | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<VehicleRow>('SELECT * FROM vehicles WHERE id = ?;', [id]);
  return row ? mapRow(row) : null;
}

export async function createVehicle(input: VehicleInput): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    `INSERT INTO vehicles (name, type, tank_capacity_litres, reserve_threshold_litres, created_at)
     VALUES (?, ?, ?, ?, ?);`,
    [
      input.name.trim(),
      input.type,
      input.tankCapacityLitres,
      input.reserveThresholdLitres,
      nowIso(),
    ],
  );
  return res.lastInsertRowId;
}

export async function updateVehicle(id: number, input: VehicleInput): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE vehicles
       SET name = ?, type = ?, tank_capacity_litres = ?, reserve_threshold_litres = ?
     WHERE id = ?;`,
    [
      input.name.trim(),
      input.type,
      input.tankCapacityLitres,
      input.reserveThresholdLitres,
      id,
    ],
  );
}

/** Cascades to fuel_entries / odometer_checkins / service_records via FK. */
export async function deleteVehicle(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM vehicles WHERE id = ?;', [id]);
}
