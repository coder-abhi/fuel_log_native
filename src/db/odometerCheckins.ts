import type { OdometerCheckin } from '@/calc';

import { getDb, nowIso } from './client';

interface CheckinRow {
  id: number;
  vehicle_id: number;
  odometer_km: number;
  checked_at: string;
  created_at: string;
  notes: string | null;
}

const mapRow = (r: CheckinRow): OdometerCheckin => ({
  id: r.id,
  vehicleId: r.vehicle_id,
  odometerKm: r.odometer_km,
  checkedAt: r.checked_at,
  createdAt: r.created_at,
  notes: r.notes,
});

export interface CheckinInput {
  vehicleId: number;
  odometerKm: number;
  checkedAt: string;
  notes: string | null;
}

export async function listCheckins(vehicleId: number): Promise<OdometerCheckin[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CheckinRow>(
    'SELECT * FROM odometer_checkins WHERE vehicle_id = ? ORDER BY checked_at ASC, created_at ASC, id ASC;',
    [vehicleId],
  );
  return rows.map(mapRow);
}

export async function createCheckin(input: CheckinInput): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    `INSERT INTO odometer_checkins (vehicle_id, odometer_km, checked_at, created_at, notes)
     VALUES (?, ?, ?, ?, ?);`,
    [input.vehicleId, input.odometerKm, input.checkedAt, nowIso(), input.notes],
  );
  return res.lastInsertRowId;
}

export async function updateCheckin(id: number, input: CheckinInput): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE odometer_checkins SET odometer_km = ?, checked_at = ?, notes = ? WHERE id = ?;',
    [input.odometerKm, input.checkedAt, input.notes, id],
  );
}

export async function deleteCheckin(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM odometer_checkins WHERE id = ?;', [id]);
}
