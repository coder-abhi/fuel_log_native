#!/usr/bin/env tsx
/**
 * Manually-runnable test scenarios for MileTrack's calc engine.
 *
 * Not connected to the app in any way — this replays a JSON sequence of
 * "log fuel" / "log odometer" / "log service" events through the same pure
 * functions in src/calc and prints exactly what the app would end up
 * showing, step by step and as a final summary.
 *
 * Usage:
 *   npm run scenarios                 interactive menu
 *   npm run scenarios -- list         print the available sets and exit
 *   npm run scenarios -- run <n>      run set number/id/name <n> and exit
 *   npm run scenarios -- create       build + save a new custom set
 *   npm run scenarios -- add <n>      append more events to set <n>
 */

import { spawnSync } from 'node:child_process';
import readline from 'node:readline/promises';

import { parseDdMmYy } from './dates';
import { runScenario } from './engine';
import { renderReport } from './report';
import { findScenario, listScenarios, saveScenario, writeScenarioFile } from './store';
import type {
  FuelEvent,
  OdometerEvent,
  Scenario,
  ScenarioEvent,
  ServiceEvent,
  VehicleType,
} from './types';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// A plain `rl.question()` loop can silently drop lines when input arrives
// faster than each call gets (re-)armed — the promise-based question API
// attaches a one-shot 'line' listener each time, and any 'line' event that
// fires with no listener attached is lost, not queued. Reading through the
// interface's async iterator instead is lossless: every line is queued
// internally and handed out in order, one per `next()`, no matter the timing.
const lineIterator = rl[Symbol.asyncIterator]();
async function ask(prompt: string): Promise<string> {
  process.stdout.write(prompt);
  const { value, done } = await lineIterator.next();
  return done ? '' : value;
}

function printList(): void {
  const sets = listScenarios();
  if (sets.length === 0) {
    console.log('No scenario sets found in scripts/scenarios/sets/.');
    return;
  }
  console.log('\nAvailable scenario sets:');
  sets.forEach((s, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ${s.scenario.name}${s.scenario.description ? ` — ${s.scenario.description}` : ''}`);
  });
}

/** The last report printed — held so "copy to clipboard" has something to copy. */
let lastReport: string | null = null;

/** Runs a scenario and prints its report. Returns the report text, or null if
 * nothing matched (so callers can tell whether to offer the post-run menu). */
function runAndPrint(idOrIndexOrName: string): string | null {
  const found = findScenario(idOrIndexOrName);
  if (!found) {
    console.log(`No scenario matches "${idOrIndexOrName}". Run "list" to see what's available.`);
    return null;
  }
  const run = runScenario(found.scenario);
  const report = renderReport(run);
  console.log('\n' + report + '\n');
  lastReport = report;
  return report;
}

/** Best-effort system clipboard copy — pbcopy (macOS), clip (Windows), xclip/xsel (Linux). */
function copyToClipboard(text: string): boolean {
  const candidates: [string, string[]][] =
    process.platform === 'darwin'
      ? [['pbcopy', []]]
      : process.platform === 'win32'
        ? [['clip', []]]
        : [
            ['xclip', ['-selection', 'clipboard']],
            ['xsel', ['--clipboard', '--input']],
          ];
  for (const [cmd, args] of candidates) {
    try {
      const res = spawnSync(cmd, args, { input: text, stdio: ['pipe', 'ignore', 'ignore'] });
      if (res.status === 0) return true;
    } catch {
      // try the next candidate
    }
  }
  return false;
}

/** Shown right after a report prints, instead of immediately re-listing sets. */
async function afterReportPrompt(): Promise<'list' | 'exit'> {
  for (;;) {
    console.log('\n  [1] Copy result to clipboard    [2] Show scenario list    [3] Exit');
    const choice = (await ask('> ')).trim().toLowerCase();
    if (choice === '1' || choice === 'copy') {
      const ok = lastReport != null && copyToClipboard(lastReport);
      console.log(ok ? 'Copied to clipboard.' : "Couldn't reach the system clipboard from here.");
      continue;
    }
    if (choice === '2' || choice === 'list' || choice === 'l') return 'list';
    if (choice === '3' || choice === 'exit' || choice === 'q' || choice === '') return 'exit';
    console.log('Enter 1, 2, or 3.');
  }
}

/** Required numeric answer — reprompts on blank or non-numeric input. */
async function askNumber(prompt: string): Promise<number> {
  for (;;) {
    const raw = (await ask(prompt)).trim();
    const n = Number(raw);
    if (raw !== '' && Number.isFinite(n)) return n;
    console.log('Please enter a number.');
  }
}

/** Optional numeric answer — blank means "skip", anything else must be a number. */
async function askOptionalNumber(prompt: string): Promise<number | null> {
  for (;;) {
    const raw = (await ask(prompt)).trim();
    if (raw === '') return null;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
    console.log('Please enter a number, or leave it blank to skip.');
  }
}

async function askYesNo(prompt: string, def: boolean): Promise<boolean> {
  const raw = (await ask(`${prompt} (${def ? 'Y/n' : 'y/N'}): `)).trim().toLowerCase();
  if (raw === '') return def;
  return raw.startsWith('y');
}

async function askDate(prompt = '  Date (dd-mm-yy): '): Promise<string> {
  for (;;) {
    const raw = await ask(prompt);
    const at = parseDdMmYy(raw);
    if (at) return at;
    console.log('  Enter a date like 13-09-25.');
  }
}

interface ChoiceOption<T> {
  label: string;
  value: T;
}

/** Numbered menu — answer with the option's number (or its label, for scripting). */
async function askChoice<T>(
  heading: string,
  options: ChoiceOption<T>[],
  defaultIndex?: number,
): Promise<T> {
  console.log(heading);
  options.forEach((o, i) => {
    console.log(`  ${i + 1}) ${o.label}${defaultIndex === i ? '  (default)' : ''}`);
  });
  const prompt = defaultIndex != null ? `> [${defaultIndex + 1}]: ` : '> ';
  for (;;) {
    const raw = (await ask(prompt)).trim();
    if (raw === '' && defaultIndex != null) return options[defaultIndex].value;
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 1 && n <= options.length) return options[n - 1].value;
    const byLabel = options.find((o) => o.label.toLowerCase() === raw.toLowerCase());
    if (byLabel) return byLabel.value;
    console.log(`  Enter a number from 1 to ${options.length}.`);
  }
}

/** Litres right after the date, so every field after it is skippable with Enter. */
async function buildFuelEvent(at: string): Promise<FuelEvent> {
  const litresFilled = await askOptionalNumber(
    '  Litres filled (blank = missed fill, no estimate): ',
  );
  const odometerKm = await askOptionalNumber('  Odometer km (blank to skip): ');

  if (litresFilled == null) {
    return { type: 'fuel', at, odometerKm, missedNoEstimate: true };
  }
  const isFullTank = await askYesNo('  Full tank?', true);
  // "Approximate" = a rough guess at the litres (not read exactly off the pump/receipt).
  // Purely informational — it never changes the mileage math.
  const isApproximate = await askYesNo('  Just a rough guess at the litres (not exact)?', false);
  const cost = await askOptionalNumber('  Cost (blank to skip): ');
  return { type: 'fuel', at, odometerKm, litresFilled, isFullTank, isApproximate, cost };
}

async function buildOdometerEvent(at: string): Promise<OdometerEvent> {
  const odometerKm = await askNumber('  Odometer km: ');
  // One skippable question instead of an enable/disable gate + a follow-up.
  const fuelPercent = await askOptionalNumber(
    '  Roughly how full does the tank look, 0-100% (blank to skip): ',
  );
  return { type: 'odometer', at, odometerKm, fuelPercent };
}

async function buildServiceEvent(at: string): Promise<ServiceEvent> {
  const odometerKm = await askOptionalNumber('  Odometer km (blank to skip): ');
  const notes = (await ask('  Notes (blank for none): ')).trim() || null;
  const cost = await askOptionalNumber('  Cost (blank to skip): ');
  return { type: 'service', at, odometerKm, notes, cost };
}

type EventKind = 'fuel' | 'odometer' | 'service' | 'done';

/** Shared event-adding loop, used both when creating a new scenario and when
 * appending to an existing one. `startingAt` numbers the prompts so they
 * continue naturally after however many events already exist. */
async function collectEvents(startingAt: number): Promise<ScenarioEvent[]> {
  const events: ScenarioEvent[] = [];
  console.log('\nAdd events one at a time. Dates are dd-mm-yy, e.g. 13-09-25.');
  for (;;) {
    const kind = await askChoice<EventKind>(
      `\nEvent ${startingAt + events.length + 1}:`,
      [
        { label: 'Fuel', value: 'fuel' },
        { label: 'Odometer', value: 'odometer' },
        { label: 'Service', value: 'service' },
        { label: 'Done', value: 'done' },
      ],
      3,
    );
    if (kind === 'done') break;
    const at = await askDate();
    if (kind === 'fuel') events.push(await buildFuelEvent(at));
    else if (kind === 'odometer') events.push(await buildOdometerEvent(at));
    else events.push(await buildServiceEvent(at));
  }
  return events;
}

async function createScenario(): Promise<Scenario> {
  console.log('\n--- Create a custom scenario ---');
  const name = (await ask('Name: ')).trim() || `Custom ${new Date().toISOString()}`;
  const description = (await ask('Description (optional): ')).trim() || undefined;

  const type = await askChoice<VehicleType>(
    '\nVehicle type:',
    [
      { label: 'Bike', value: 'bike' },
      { label: 'Car', value: 'car' },
      { label: 'Scooty', value: 'scooty' },
    ],
    0,
  );
  const tankCapacityLitres = (await askOptionalNumber('Tank capacity litres (blank = 15): ')) ?? 15;
  const reserveThresholdLitres =
    (await askOptionalNumber('Reserve threshold litres (blank = 2): ')) ?? 2;

  const events = await collectEvents(0);

  return {
    name,
    description,
    vehicle: { type, tankCapacityLitres, reserveThresholdLitres },
    events,
  };
}

/** Builds + saves a new scenario, offers to run it. Returns whether it ran (so
 * the caller knows whether to show the post-run menu next). */
async function createScenarioFlow(): Promise<boolean> {
  const scenario = await createScenario();
  const filePath = saveScenario(scenario);
  console.log(`\nSaved to ${filePath}`);
  if (await askYesNo('Run it now?', true)) return runAndPrint(scenario.name) != null;
  return false;
}

/** Appends one or more events to an already-saved scenario, in place. Returns
 * whether it ran afterward (so the caller knows whether to show the post-run menu). */
async function addEntryFlow(preselect?: string): Promise<boolean> {
  let found = preselect ? findScenario(preselect) : null;
  if (!found) {
    printList();
    const choice = (await ask('\nAdd entries to which set? [number]: ')).trim();
    found = findScenario(choice);
  }
  if (!found) {
    console.log(`No scenario matches "${preselect ?? ''}". Run "list" to see what's available.`);
    return false;
  }

  console.log(
    `\n--- Adding to "${found.scenario.name}" (currently ${found.scenario.events.length} event(s)) ---`,
  );
  const newEvents = await collectEvents(found.scenario.events.length);
  if (newEvents.length === 0) {
    console.log('Nothing added.');
    return false;
  }

  found.scenario.events.push(...newEvents);
  writeScenarioFile(found.filePath, found.scenario);
  console.log(`\nSaved ${newEvents.length} new event(s) to ${found.filePath}`);
  if (await askYesNo('Run it now?', true)) return runAndPrint(found.id) != null;
  return false;
}

/** Recurses back into itself to "show the list again" — a report just shown
 * gets the compact post-run menu instead of an immediate full re-list. */
async function interactiveMenu(): Promise<void> {
  printList();
  console.log(
    '\n  [number] run that set    [a] add entries to a set    [c] create custom set    [q] quit',
  );
  const choice = (await ask('\n> ')).trim().toLowerCase();
  if (choice === 'q' || choice === 'quit' || choice === 'exit') return;

  let ranReport = false;
  if (choice === 'a' || choice === 'add') {
    ranReport = await addEntryFlow();
  } else if (choice === 'c' || choice === 'create') {
    ranReport = await createScenarioFlow();
  } else if (choice !== '') {
    ranReport = runAndPrint(choice) != null;
  }

  if (ranReport && (await afterReportPrompt()) === 'exit') return;
  return interactiveMenu();
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  let ranReport = false;

  if (!cmd) {
    await interactiveMenu();
    rl.close();
    return;
  } else if (cmd === 'list') {
    printList();
  } else if (cmd === 'run') {
    if (!rest[0]) {
      console.log('Usage: npm run scenarios -- run <number|id|name>');
    } else {
      ranReport = runAndPrint(rest.join(' ')) != null;
    }
  } else if (cmd === 'create') {
    ranReport = await createScenarioFlow();
  } else if (cmd === 'add') {
    ranReport = await addEntryFlow(rest[0]);
  } else {
    // treat a bare argument as "run <that>"
    ranReport = runAndPrint(cmd) != null;
  }

  if (ranReport && (await afterReportPrompt()) === 'list') {
    await interactiveMenu();
  }
  rl.close();
}

main().catch((e) => {
  console.error(e);
  rl.close();
  process.exit(1);
});
