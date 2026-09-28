/**
 * JSON shape for a manually-runnable test scenario.
 *
 * A scenario is a chronological sequence of "events" (log fuel / log odometer
 * / log a service) that gets replayed through the exact same calculation
 * engine the app uses (src/calc — nothing here talks to SQLite or React).
 * Events are applied in the order they appear in the array (which is also the
 * order ids get assigned, so you can model logging something late/backdated
 * by giving it an earlier `at` than the event before it).
 */

export type VehicleType = 'bike' | 'car' | 'scooty';

export interface ScenarioVehicle {
  type: VehicleType;
  tankCapacityLitres: number;
  reserveThresholdLitres: number;
}

export interface FuelEvent {
  type: 'fuel';
  at: string;
  /** omit to log this fill without an odometer reading (optional-but-recommended) */
  odometerKm?: number | null;
  /** omit together with missedNoEstimate to mark a "missed fill, no estimate" entry */
  litresFilled?: number | null;
  isFullTank?: boolean;
  isApproximate?: boolean;
  /** true = "I missed a fill-up before this and have no estimate for it" */
  missedNoEstimate?: boolean;
  cost?: number | null;
  notes?: string | null;
}

export interface OdometerEvent {
  type: 'odometer';
  at: string;
  odometerKm: number;
  /** 0-100, omit to leave the fuel-level slider "disabled" for this check-in */
  fuelPercent?: number | null;
  notes?: string | null;
}

export interface ServiceEvent {
  type: 'service';
  at: string;
  odometerKm?: number | null;
  cost?: number | null;
  notes?: string | null;
}

export type ScenarioEvent = FuelEvent | OdometerEvent | ServiceEvent;

export interface Scenario {
  name: string;
  description?: string;
  vehicle: ScenarioVehicle;
  events: ScenarioEvent[];
  /**
   * Instant driving-pattern stats (this week / this month) are computed as of.
   * Defaults to just after the last event's timestamp.
   */
  asOf?: string;
}
