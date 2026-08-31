import * as SQLite from 'expo-sqlite';

import { MIGRATIONS } from './schema';

const DB_NAME = 'miletrack.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function open(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  return db;
}

async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  let version = row?.user_version ?? 0;

  for (let i = version; i < MIGRATIONS.length; i++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[i]);
    });
    version = i + 1;
    // user_version can't be parameterised
    await db.execAsync(`PRAGMA user_version = ${version};`);
  }
}

/** Lazily open + migrate the database once, then reuse the handle. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = open();
  return dbPromise;
}

/** Test / dev helper: wipe every row (schema kept). */
export async function resetAllData(): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM fuel_entries;
      DELETE FROM odometer_checkins;
      DELETE FROM service_records;
      DELETE FROM vehicles;
    `);
  });
}

export const boolToInt = (b: boolean): number => (b ? 1 : 0);
export const intToBool = (n: number | null | undefined): boolean => n === 1;
export const nowIso = (): string => new Date().toISOString();
