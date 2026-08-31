/**
 * Derives every figure the UI shows from the raw store arrays. Pure calc
 * functions + useMemo => any add/edit/delete that reloads the arrays refreshes
 * all of these automatically, no manual "recalculate" step.
 */

import { useMemo } from 'react';

import {
  drivingPatternStats,
  estimateRemainingFuel,
  lifetimeMileage,
  mileageTrendPoints,
  serviceIntervalBuckets,
  sinceLastServiceMileage,
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
    const lifetime = lifetimeMileage(fuelEntries);
    const sinceService = sinceLastServiceMileage(fuelEntries, services);
    const fuel = vehicle
      ? estimateRemainingFuel({ vehicle, fuelEntries, odometerCheckins: checkins, services })
      : null;

    let lastKnownOdometer: number | null = null;
    let lastKnownOdometerAt: string | null = null;
    let lastAt = -Infinity;
    let totalLitresFilled = 0;
    for (const f of fuelEntries) {
      totalLitresFilled += f.litresFilled ?? 0;
      const t = Date.parse(f.filledAt);
      if (t >= lastAt) {
        lastAt = t;
        lastKnownOdometer = f.odometerKm;
        lastKnownOdometerAt = f.filledAt;
      }
    }
    for (const c of checkins) {
      const t = Date.parse(c.checkedAt);
      if (t >= lastAt) {
        lastAt = t;
        lastKnownOdometer = c.odometerKm;
        lastKnownOdometerAt = c.checkedAt;
      }
    }

    return {
      hasData: fuelEntries.length > 0 || checkins.length > 0,
      lifetime,
      sinceService,
      fuel,
      buckets: serviceIntervalBuckets(fuelEntries, services),
      trend: mileageTrendPoints(fuelEntries),
      driving: drivingPatternStats({ fuelEntries, odometerCheckins: checkins }),
      lastKnownOdometer,
      lastKnownOdometerAt,
      totalLitresFilled,
    };
  }, [vehicle, fuelEntries, checkins, services]);
}
