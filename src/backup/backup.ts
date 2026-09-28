/**
 * JSON backup / restore.
 *
 * A snapshot of the whole database (every vehicle and its entries) is kept as
 * a single JSON file in the app's document directory, rewritten after every
 * mutation. On a fresh install with an empty database, bootstrap() checks
 * that file and restores from it automatically — this survives app updates
 * and OS-level app-data restores (Android Auto Backup, device transfers),
 * though not a plain uninstall, since that wipes app-private storage.
 *
 * The same file format can be picked from anywhere via the system file
 * picker (Google Drive, Downloads, a shared file, ...), so a backup can also
 * be carried between devices manually.
 */

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { exportSnapshot, importSnapshot, type BackupSnapshot } from '@/db';

const APP_ID = 'miletrack';
const SCHEMA_VERSION = 1;
const FILE_NAME = 'miletrack-backup.json';

export interface BackupFile {
  app: typeof APP_ID;
  schemaVersion: number;
  exportedAt: string;
  data: BackupSnapshot;
}

function backupFile(): File {
  return new File(Paths.document, FILE_NAME);
}

function isBackupFile(value: unknown): value is BackupFile {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.app !== APP_ID || typeof v.schemaVersion !== 'number') return false;
  const data = v.data as Record<string, unknown> | undefined;
  return (
    !!data &&
    Array.isArray(data.vehicles) &&
    Array.isArray(data.fuelEntries) &&
    Array.isArray(data.checkins) &&
    Array.isArray(data.services)
  );
}

/** Rewrites the on-device backup file from the current database contents. */
export async function writeAutoBackup(): Promise<void> {
  try {
    const data = await exportSnapshot();
    const contents: BackupFile = {
      app: APP_ID,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    };
    const file = backupFile();
    if (!file.exists) file.create({ intermediates: true });
    file.write(JSON.stringify(contents));
  } catch {
    // Best-effort — a failed backup write should never block the app.
  }
}

/** Reads the on-device backup file, if one exists and is valid. Used at bootstrap. */
export async function readAutoBackup(): Promise<BackupFile | null> {
  const file = backupFile();
  if (!file.exists) return null;
  try {
    const parsed = JSON.parse(await file.text());
    return isBackupFile(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export type PickBackupResult =
  | { status: 'ok'; backup: BackupFile }
  | { status: 'invalid' }
  | { status: 'canceled' };

/** Opens the system file picker restricted to .json, and validates the pick. */
export async function pickBackupFile(): Promise<PickBackupResult> {
  const { canceled, result } = await File.pickFileAsync({
    mimeTypes: ['application/json'],
  });
  if (canceled) return { status: 'canceled' };
  try {
    const parsed = JSON.parse(await result.text());
    if (!isBackupFile(parsed)) return { status: 'invalid' };
    return { status: 'ok', backup: parsed };
  } catch {
    return { status: 'invalid' };
  }
}

/** Replaces all app data with the given backup's contents. */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  await importSnapshot(backup.data);
  await writeAutoBackup();
}

/** Shares the current backup file via the system share sheet (Drive, Downloads, ...). */
export async function shareBackupFile(): Promise<void> {
  await writeAutoBackup();
  const file = backupFile();
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Export MileTrack backup',
    });
  }
}
