import fs from 'node:fs';
import path from 'node:path';

import type { Scenario } from './types';

export const SETS_DIR = path.join(__dirname, 'sets');

export interface ScenarioFile {
  /** file name without .json, used as the id you pass to `run` */
  id: string;
  filePath: string;
  scenario: Scenario;
}

export function listScenarios(): ScenarioFile[] {
  if (!fs.existsSync(SETS_DIR)) return [];
  return fs
    .readdirSync(SETS_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const filePath = path.join(SETS_DIR, f);
      const scenario = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Scenario;
      return { id: f.replace(/\.json$/, ''), filePath, scenario };
    });
}

export function findScenario(idOrIndexOrName: string): ScenarioFile | null {
  const all = listScenarios();
  const asIndex = Number(idOrIndexOrName);
  if (Number.isInteger(asIndex) && asIndex >= 1 && asIndex <= all.length) {
    return all[asIndex - 1];
  }
  const needle = idOrIndexOrName.trim().toLowerCase();
  return (
    all.find((s) => s.id.toLowerCase() === needle) ??
    all.find((s) => s.scenario.name.toLowerCase() === needle) ??
    all.find((s) => s.id.toLowerCase().includes(needle)) ??
    null
  );
}

function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || `custom-${Date.now()}`;
}

/** Saves a new custom scenario JSON into sets/, returning the file path. */
export function saveScenario(scenario: Scenario): string {
  if (!fs.existsSync(SETS_DIR)) fs.mkdirSync(SETS_DIR, { recursive: true });
  let base = slugify(scenario.name);
  let filePath = path.join(SETS_DIR, `${base}.json`);
  let n = 2;
  while (fs.existsSync(filePath)) {
    filePath = path.join(SETS_DIR, `${base}-${n}.json`);
    n += 1;
  }
  fs.writeFileSync(filePath, JSON.stringify(scenario, null, 2) + '\n');
  return filePath;
}

/** Overwrites an existing scenario file in place (e.g. after appending events). */
export function writeScenarioFile(filePath: string, scenario: Scenario): void {
  fs.writeFileSync(filePath, JSON.stringify(scenario, null, 2) + '\n');
}
