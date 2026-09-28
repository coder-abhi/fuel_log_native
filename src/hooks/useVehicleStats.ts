/**
 * Derives every figure the UI shows from the raw store arrays. Pure calc
 * functions + useMemo => any add/edit/delete that reloads the arrays refreshes
 * all of these automatically, no manual "recalculate" step.
 */

import { useMemo } from 'react';

import {
  currentOdometer,
  drivingPatternStats,
  estimateRemainingFuel,
  lifetimeMileage,
  lifetimeMileageFuelBalance,
  mileageTrendPoints,
  serviceIntervalBuckets,
  sinceLastServiceMileage,
  sinceLastServiceMileageFuelBalance,
  type DrivingPatternStats,
  type MileageResult,
  type RemainingFuelResult,
  type ServiceIntervalBucket,
  type TrendPoint,
} from '@/calc';
import { useAppStore, useSelectedVehicle } from '@/store/appStore';

export interface VehicleStats {
  hasData: boolean;
  lifetime: MileageResult;
  sinceService: MileageResult;
  fuel: RemainingFuelResult | null;
  buckets: ServiceIntervalBucket[];
  trend: TrendPoint[];
  driving: DrivingPatternStats;
  lastKnownOdometer: number | null;
  /** timestamp (ISO) of the reading `lastKnownOdometer` came from */
  lastKnownOdometerAt: string | null;
  /** total litres logged across every fuel entry so far */
  totalLitresFilled: number;
}

export function useVehicleStats(): VehicleStats {
  const vehicle = useSelectedVehicle();
  const fuelEntries = useAppStore((s) => s.fuelEntries);
  const checkins = useAppStore((s) => s.checkins);
  const services = useAppStore((s) => s.services);

  return useMemo<VehicleStats>(() => {
    const fuel = vehicle
      ? estimateRemainingFuel({ vehicle, fuelEntries, odometerCheckins: checkins, services })
      : null;

    // Fuel-balance model (see src/calc/fuelBalance.ts): walks the whole fuel
    // history as full-tank-to-full-tank segments (every litre added in
    // between is exactly what was consumed), closing the still-open final
    // stretch with the same estimated-remaining-fuel figure as the Range
    // card. Needs a vehicle (tank capacity) to do the math; falls back to the
    // older fill-to-fill model on the rare render with no vehicle selected.
    const lifetime = vehicle
      ? lifetimeMileageFuelBalance(fuelEntries, vehicle, checkins, services)
      : lifetimeMileage(fuelEntries);
    const sinceService = vehicle
      ? sinceLastServiceMileageFuelBalance(fuelEntries, vehicle, checkins, services)
      : sinceLastServiceMileage(fuelEntries, services);

    // Same "latest reading across both timelines" logic estimateRemainingFuel
    // itself anchors on — reused here (rather than reimplemented) so the
    // "current odometer" shown in the UI can never drift from what the fuel
    // estimate is actually built on.
    const current = currentOdometer(fuelEntries, checkins);
    const totalLitresFilled = fuelEntries.reduce((sum, f) => sum + (f.litresFilled ?? 0), 0);

    return {
      hasData: fuelEntries.length > 0 || checkins.length > 0,
      lifetime,
      sinceService,
      fuel,
      buckets: serviceIntervalBuckets(fuelEntries, services),
      trend: mileageTrendPoints(fuelEntries),
      driving: drivingPatternStats({ fuelEntries, odometerCheckins: checkins }),
      lastKnownOdometer: current?.odometerKm ?? null,
      lastKnownOdometerAt: current?.at ?? null,
      totalLitresFilled,
    };
  }, [vehicle, fuelEntries, checkins, services]);
}
