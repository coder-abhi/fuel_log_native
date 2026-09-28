/** Formats a ScenarioRun as readable console output. Pure string building — no I/O. */

import { fmtDdMmYy } from './dates';
import type { ScenarioEvent } from './types';
import type { ScenarioRun } from './engine';

const rule = (ch = '─', len = 72) => ch.repeat(len);

function km(v: number | null | undefined): string {
  return v == null ? '—' : `${Math.round(v * 10) / 10} km`;
}

function litres(v: number | null | undefined): string {
  return v == null ? '—' : `${Math.round(v * 100) / 100} L`;
}

function kmpl(v: number | null | undefined): string {
  return v == null ? 'n/a' : `${(Math.round(v * 100) / 100).toFixed(2)} km/l`;
}

function money(v: number | null | undefined): string {
  return v == null ? '—' : `₹${Math.round(v * 100) / 100}`;
}

function eventLine(e: ScenarioEvent): string {
  const date = fmtDdMmYy(e.at);
  if (e.type === 'fuel') {
    const bits = [
      e.odometerKm != null ? `odo=${e.odometerKm}` : 'odo=(skipped)',
      e.missedNoEstimate
        ? 'MISSED FILL (no estimate)'
        : `${e.litresFilled ?? '?'}L${e.isFullTank ? ' full' : ' partial'}${e.isApproximate ? ' approx' : ''}`,
    ];
    return `FUEL      ${date}  ${bits.join('  ')}`;
  }
  if (e.type === 'odometer') {
    const fuel = e.fuelPercent != null ? `  fuel~${e.fuelPercent}%` : '';
    return `ODOMETER  ${date}  odo=${e.odometerKm}${fuel}`;
  }
  const odo = e.odometerKm != null ? `  odo=${e.odometerKm}` : '';
  return `SERVICE   ${date}${odo}${e.notes ? `  "${e.notes}"` : ''}`;
}

export function renderReport(run: ScenarioRun): string {
  const lines: string[] = [];
  const s = run.scenario;

  lines.push(rule('='));
  lines.push(`SCENARIO: ${s.name}`);
  if (s.description) lines.push(s.description);
  lines.push(
    `Vehicle: ${s.vehicle.type}, tank ${s.vehicle.tankCapacityLitres}L, reserve ${s.vehicle.reserveThresholdLitres}L`,
  );
  lines.push(rule('='));
  lines.push('');
  lines.push('STEP-BY-STEP');
  lines.push(rule());
  for (const step of run.steps) {
    lines.push(
      `[${String(step.index).padStart(2, '0')}] ${eventLine(step.event)}`.padEnd(64) +
        `lifetime ${kmpl(step.lifetimeKmPerLitre)}   since-service ${kmpl(step.sinceServiceKmPerLitre)}`,
    );
  }

  lines.push('');
  lines.push('FINAL RESULT');
  lines.push(rule());
  const f = run.final;
  lines.push(`Lifetime mileage        : ${kmpl(f.lifetime.kmPerLitre)}  (${km(f.lifetime.totalKm)} / ${litres(f.lifetime.totalLitres)}, ${f.lifetime.countedIntervals} interval(s))`);
  lines.push(`Since-last-service      : ${kmpl(f.sinceService.kmPerLitre)}  (${km(f.sinceService.totalKm)} / ${litres(f.sinceService.totalLitres)}, ${f.sinceService.countedIntervals} interval(s))`);
  lines.push(`Last known odometer     : ${km(f.lastKnownOdometerKm)}`);
  lines.push(`Total litres filled     : ${litres(f.totalLitresFilled)}`);
  lines.push(`Total fuel cost         : ${money(f.totalFuelCost)}`);
  lines.push(`Total service cost      : ${money(f.totalServiceCost)}`);
  lines.push('');
  lines.push('Remaining fuel estimate:');
  if (f.fuel.canEstimate) {
    lines.push(`  Remaining   : ${litres(f.fuel.remainingLitres)}`);
    lines.push(`  Range       : ${km(f.fuel.estimatedRangeKm)}`);
    lines.push(`  Mileage used: ${f.fuel.mileageUsed != null ? kmpl(f.fuel.mileageUsed) : 'rough per-type estimate (not enough real data yet)'}`);
    lines.push(`  At/below reserve: ${f.fuel.atOrBelowReserve ? 'YES' : 'no'}`);
  } else {
    lines.push(`  Can't estimate yet — reason: ${f.fuel.reason}`);
  }

  lines.push('');
  lines.push('Service-interval buckets:');
  if (f.buckets.length === 0) {
    lines.push('  (none)');
  } else {
    for (const b of f.buckets) {
      lines.push(
        `  ${b.label.padEnd(12)} ${b.ongoing ? '(ongoing) ' : '          '}${kmpl(b.kmPerLitre)}  (${km(b.totalKm)} / ${litres(b.totalLitres)})`,
      );
    }
  }

  lines.push('');
  lines.push(`Mileage trend points: ${f.trend.length}`);
  for (const p of f.trend) {
    lines.push(`  ${fmtDdMmYy(p.at)}  ->  ${kmpl(p.kmPerLitre)}`);
  }

  lines.push('');
  lines.push('Driving pattern:');
  lines.push(`  This week           : ${km(f.driving.kmThisWeek)}`);
  lines.push(`  This month          : ${km(f.driving.kmThisMonth)}`);
  lines.push(`  Weekday avg / trip  : ${km(f.driving.weekdayAvgKm)}`);
  lines.push(`  Weekend avg / trip  : ${km(f.driving.weekendAvgKm)}`);

  lines.push('');
  lines.push(rule('='));

  return lines.join('\n');
}
