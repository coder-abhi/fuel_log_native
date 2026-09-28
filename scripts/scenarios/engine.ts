/**
 * Replays a Scenario through the real calc engine (src/calc) and produces a
 * step-by-step trace plus a final stats summary. No React / SQLite / app code
 * is touched — this is the same pure math the app itself runs on, just fed
 * from a JSON script instead of the UI.
 */

import {
  currentOdometer,
  drivingPatternStats,
  estimateRemainingFuel,
  lifetimeMileageFuelBalance,
  mileageTrendPoints,
  serviceIntervalBuckets,
  sinceLastServiceMileageFuelBalance,
  type DrivingPatternStats,
  type FuelEntry,
  type MileageResult,
  type OdometerCheckin,
  type RemainingFuelResult,
  type ServiceIntervalBucket,
  type ServiceRecord,
  type TrendPoint,
  type Vehicle,
} from '../../src/calc';
import type { Scenario, ScenarioEvent } from './types';

export interface StepResult {
  index: number;
  event: ScenarioEvent;
  /** lifetime km/l immediately after this event, or null if not enough data yet */
  lifetimeKmPerLitre: number | null;
  /** since-last-service km/l immediately after this event */
  sinceServiceKmPerLitre: number | null;
  lastKnownOdometerKm: number | null;
}

export interface ScenarioRun {
  scenario: Scenario;
  vehicle: Vehicle;
  fuelEntries: FuelEntry[];
  checkins: OdometerCheckin[];
  services: ServiceRecord[];
  steps: StepResult[];
  final: {
    lifetime: MileageResult;
    sinceService: MileageResult;
    fuel: RemainingFuelResult;
    buckets: ServiceIntervalBucket[];
    trend: TrendPoint[];
    driving: DrivingPatternStats;
    lastKnownOdometerKm: number | null;
    totalLitresFilled: number;
    totalFuelCost: number;
    totalServiceCost: number;
  };
}

let nextId = 1;

/** Thin wrapper so call sites below read the same as the app's own hook. */
function lastKnownOdometer(
  fuelEntries: readonly FuelEntry[],
  checkins: readonly OdometerCheckin[],
): number | null {
  return currentOdometer(fuelEntries, checkins)?.odometerKm ?? null;
}

export function runScenario(scenario: Scenario): ScenarioRun {
  nextId = 1;
  const vehicle: Vehicle = {
    id: 1,
    name: scenario.name,
    type: scenario.vehicle.type,
    tankCapacityLitres: scenario.vehicle.tankCapacityLitres,
    reserveThresholdLitres: scenario.vehicle.reserveThresholdLitres,
    createdAt: scenario.events[0]?.at ?? new Date().toISOString(),
  };

  const fuelEntries: FuelEntry[] = [];
  const checkins: OdometerCheckin[] = [];
  const services: ServiceRecord[] = [];
  const steps: StepResult[] = [];

  for (const event of scenario.events) {
    const id = nextId++;
    if (event.type === 'fuel') {
      const missed = !!event.missedNoEstimate;
      fuelEntries.push({
        id,
        vehicleId: vehicle.id,
        odometerKm: event.odometerKm ?? null,
        litresFilled: event.litresFilled ?? null,
        isFullTank: missed ? false : !!event.isFullTank,
        isApproximate: !missed && !!event.isApproximate,
        excludedFromMileage: missed,
        cost: event.cost ?? null,
        filledAt: event.at,
        createdAt: event.at,
        notes: event.notes ?? null,
      });
    } else if (event.type === 'odometer') {
      checkins.push({
        id,
        vehicleId: vehicle.id,
        odometerKm: event.odometerKm,
        checkedAt: event.at,
        createdAt: event.at,
        notes: event.notes ?? null,
        fuelPercent: event.fuelPercent ?? null,
      });
    } else {
      services.push({
        id,
        vehicleId: vehicle.id,
        odometerKm: event.odometerKm ?? null,
        servicedAt: event.at,
        cost: event.cost ?? null,
        notes: event.notes ?? null,
        createdAt: event.at,
      });
    }

    steps.push({
      index: steps.length + 1,
      event,
      lifetimeKmPerLitre: lifetimeMileageFuelBalance(fuelEntries, vehicle, checkins, services).kmPerLitre,
      sinceServiceKmPerLitre: sinceLastServiceMileageFuelBalance(fuelEntries, vehicle, checkins, services)
        .kmPerLitre,
      lastKnownOdometerKm: lastKnownOdometer(fuelEntries, checkins),
    });
  }

  const asOf = scenario.asOf
    ? new Date(scenario.asOf)
    : new Date(
        Math.max(0, ...scenario.events.map((e) => Date.parse(e.at))) + 1000,
      );

  const totalLitresFilled = fuelEntries.reduce((s, f) => s + (f.litresFilled ?? 0), 0);
  const totalFuelCost = fuelEntries.reduce((s, f) => s + (f.cost ?? 0), 0);
  const totalServiceCost = services.reduce((s, r) => s + (r.cost ?? 0), 0);

  // Fuel-balance model, same as the app's own dashboard (useVehicleStats).
  const lifetime = lifetimeMileageFuelBalance(fuelEntries, vehicle, checkins, services);
  const sinceService = sinceLastServiceMileageFuelBalance(fuelEntries, vehicle, checkins, services);

  return {
    scenario,
    vehicle,
    fuelEntries,
    checkins,
    services,
    steps,
    final: {
      lifetime,
      sinceService,
      fuel: estimateRemainingFuel({ vehicle, fuelEntries, odometerCheckins: checkins, services }),
      buckets: serviceIntervalBuckets(fuelEntries, services),
      trend: mileageTrendPoints(fuelEntries),
      driving: drivingPatternStats({ fuelEntries, odometerCheckins: checkins, now: asOf }),
      lastKnownOdometerKm: lastKnownOdometer(fuelEntries, checkins),
      totalLitresFilled,
      totalFuelCost,
      totalServiceCost,
    },
  };
}
