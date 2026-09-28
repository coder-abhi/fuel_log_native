/**
 * Schema + forward-only migrations.
 *
 * Versioning uses SQLite's `PRAGMA user_version`. Each migration is an index in
 * MIGRATIONS (0 -> 1 is MIGRATIONS[0], etc). To evolve the schema later, append
 * a new SQL string — never edit an existing one.
 */

export const MIGRATIONS: string[] = [
  // v1 — initial schema
  `
  CREATE TABLE vehicles (
    id INTEGER PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    tank_capacity_litres REAL NOT NULL,
    reserve_threshold_litres REAL NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE fuel_entries (
    id INTEGER PRIMARY KEY NOT NULL,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    odometer_km REAL NOT NULL,
    litres_filled REAL,
    is_full_tank INTEGER NOT NULL DEFAULT 0,
    is_approximate INTEGER NOT NULL DEFAULT 0,
    excluded_from_mileage INTEGER NOT NULL DEFAULT 0,
    cost REAL,
    filled_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    notes TEXT
  );
  CREATE INDEX idx_fuel_vehicle_filled ON fuel_entries(vehicle_id, filled_at);

  CREATE TABLE odometer_checkins (
    id INTEGER PRIMARY KEY NOT NULL,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    odometer_km REAL NOT NULL,
    checked_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    notes TEXT
  );
  CREATE INDEX idx_checkin_vehicle_checked ON odometer_checkins(vehicle_id, checked_at);

  CREATE TABLE service_records (
    id INTEGER PRIMARY KEY NOT NULL,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    odometer_km REAL NOT NULL,
    serviced_at TEXT NOT NULL,
    cost REAL,
    notes TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_service_vehicle_serviced ON service_records(vehicle_id, serviced_at);
  `,

  // v2 — service odometer becomes optional (only the service date is required)
  `
  CREATE TABLE service_records_new (
    id INTEGER PRIMARY KEY NOT NULL,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    odometer_km REAL,
    serviced_at TEXT NOT NULL,
    cost REAL,
    notes TEXT,
    created_at TEXT NOT NULL
  );
  INSERT INTO service_records_new (id, vehicle_id, odometer_km, serviced_at, cost, notes, created_at)
    SELECT id, vehicle_id, odometer_km, serviced_at, cost, notes, created_at FROM service_records;
  DROP TABLE service_records;
  ALTER TABLE service_records_new RENAME TO service_records;
  CREATE INDEX idx_service_vehicle_serviced ON service_records(vehicle_id, serviced_at);
  `,

  // v3 — vehicle class, used only for the bootstrap mileage fallback
  `
  ALTER TABLE vehicles ADD COLUMN type TEXT NOT NULL DEFAULT 'bike';
  `,

  // v4 — fuel entry odometer becomes optional (recommended, not required);
  // odometer check-ins gain an optional approximate tank-fill percentage.
  `
  CREATE TABLE fuel_entries_new (
    id INTEGER PRIMARY KEY NOT NULL,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    odometer_km REAL,
    litres_filled REAL,
    is_full_tank INTEGER NOT NULL DEFAULT 0,
    is_approximate INTEGER NOT NULL DEFAULT 0,
    excluded_from_mileage INTEGER NOT NULL DEFAULT 0,
    cost REAL,
    filled_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    notes TEXT
  );
  INSERT INTO fuel_entries_new
    (id, vehicle_id, odometer_km, litres_filled, is_full_tank, is_approximate,
     excluded_from_mileage, cost, filled_at, created_at, notes)
    SELECT id, vehicle_id, odometer_km, litres_filled, is_full_tank, is_approximate,
           excluded_from_mileage, cost, filled_at, created_at, notes FROM fuel_entries;
  DROP TABLE fuel_entries;
  ALTER TABLE fuel_entries_new RENAME TO fuel_entries;
  CREATE INDEX idx_fuel_vehicle_filled ON fuel_entries(vehicle_id, filled_at);

  ALTER TABLE odometer_checkins ADD COLUMN fuel_percent REAL;
  `,
];
