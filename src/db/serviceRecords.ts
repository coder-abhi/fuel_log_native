import type { ServiceRecord } from '@/calc';

import { getDb, nowIso } from './client';

interface ServiceRow {
  id: number;
  vehicle_id: number;
  odometer_km: number | null;
  serviced_at: string;
  cost: number | null;
  notes: string | null;
  created_at: string;
}

const mapRow = (r: ServiceRow): ServiceRecord => ({
  id: r.id,
  vehicleId: r.vehicle_id,
  odometerKm: r.odometer_km,
  servicedAt: r.serviced_at,
  cost: r.cost,
  notes: r.notes,
  createdAt: r.created_at,
});

export interface ServiceInput {
  vehicleId: number;
  odometerKm: number | null;
  servicedAt: string;
  cost: number | null;
  notes: string | null;
}

export async function listServiceRecords(vehicleId: number): Promise<ServiceRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ServiceRow>(
    'SELECT * FROM service_records WHERE vehicle_id = ? ORDER BY serviced_at ASC, created_at ASC, id ASC;',
    [vehicleId],
  );
  return rows.map(mapRow);
}

/** Every service record across every vehicle, for full-data backup/export. */
export async function listAllServiceRecords(): Promise<ServiceRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ServiceRow>(
    'SELECT * FROM service_records ORDER BY vehicle_id ASC, serviced_at ASC, id ASC;',
  );
  return rows.map(mapRow);
}

export async function createServiceRecord(input: ServiceInput): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    `INSERT INTO service_records (vehicle_id, odometer_km, serviced_at, cost, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?);`,
    [input.vehicleId, input.odometerKm, input.servicedAt, input.cost, input.notes, nowIso()],
  );
  return res.lastInsertRowId;
}

export async function updateServiceRecord(id: number, input: ServiceInput): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE service_records SET odometer_km = ?, serviced_at = ?, cost = ?, notes = ? WHERE id = ?;',
    [input.odometerKm, input.servicedAt, input.cost, input.notes, id],
  );
}

export async function deleteServiceRecord(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM service_records WHERE id = ?;', [id]);
}
