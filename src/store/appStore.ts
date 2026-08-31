/**
 * Single app store.
 *
 * Recalculation model (per spec — "don't build a separate recalculate step"):
 * every mutation writes to SQLite and then reloads the affected raw arrays into
 * the store. Screens derive mileage / fuel / stats from those arrays with
 * useMemo (see src/hooks/useVehicleStats.ts), so any edit anywhere refreshes
 * every dependent display automatically.
 *
 * Persisted (AsyncStorage): only the selected vehicle id and the "last full
 * tank" toggle preference. All real data lives in SQLite.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { FuelEntry, OdometerCheckin, ServiceRecord, Vehicle } from '@/calc';
import {
  createCheckin,
  createFuelEntry,
  createServiceRecord,
  createVehicle,
  deleteCheckin,
  deleteFuelEntry,
  deleteServiceRecord,
  deleteVehicle,
  getDb,
  listCheckins,
  listFuelEntries,
  listServiceRecords,
  listVehicles,
  updateCheckin,
  updateFuelEntry,
  updateServiceRecord,
  updateVehicle,
  type CheckinInput,
  type FuelEntryInput,
  type ServiceInput,
  type VehicleInput,
} from '@/db';

interface Persisted {
  selectedVehicleId: number | null;
  lastFullTank: boolean;
}

interface AppState extends Persisted {
  ready: boolean;
  vehicles: Vehicle[];
  fuelEntries: FuelEntry[];
  checkins: OdometerCheckin[];
  services: ServiceRecord[];

  bootstrap: () => Promise<void>;
  reloadVehicles: () => Promise<void>;
  reloadEntries: () => Promise<void>;
  selectVehicle: (id: number) => Promise<void>;

  addVehicle: (input: VehicleInput) => Promise<number>;
  editVehicle: (id: number, input: VehicleInput) => Promise<void>;
  removeVehicle: (id: number) => Promise<void>;

  addFuelEntry: (input: Omit<FuelEntryInput, 'vehicleId'>) => Promise<void>;
  editFuelEntry: (id: number, input: Omit<FuelEntryInput, 'vehicleId'>) => Promise<void>;
  removeFuelEntry: (id: number) => Promise<void>;

  addCheckin: (input: Omit<CheckinInput, 'vehicleId'>) => Promise<void>;
  editCheckin: (id: number, input: Omit<CheckinInput, 'vehicleId'>) => Promise<void>;
  removeCheckin: (id: number) => Promise<void>;

  addService: (input: Omit<ServiceInput, 'vehicleId'>) => Promise<void>;
  editService: (id: number, input: Omit<ServiceInput, 'vehicleId'>) => Promise<void>;
  removeService: (id: number) => Promise<void>;

  setLastFullTank: (v: boolean) => void;
}

const emptyEntries = (): Pick<AppState, 'fuelEntries' | 'checkins' | 'services'> => ({
  fuelEntries: [],
  checkins: [],
  services: [],
});

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ready: false,
      selectedVehicleId: null,
      lastFullTank: true,
      vehicles: [],
      fuelEntries: [],
      checkins: [],
      services: [],

      bootstrap: async () => {
        // Make sure persisted prefs (selected vehicle, last full-tank) are loaded
        // from AsyncStorage before we pick a default vehicle.
        try {
          await useAppStore.persist.rehydrate();
        } catch {
          // ignore — fall back to defaults
        }
        await getDb(); // opens + migrates
        const vehicles = await listVehicles();
        let selectedVehicleId = get().selectedVehicleId;
        if (!selectedVehicleId || !vehicles.some((v) => v.id === selectedVehicleId)) {
          selectedVehicleId = vehicles[0]?.id ?? null;
        }
        set({ vehicles, selectedVehicleId, ready: true, ...emptyEntries() });
        if (selectedVehicleId) await get().reloadEntries();
      },

      reloadVehicles: async () => {
        const vehicles = await listVehicles();
        let selectedVehicleId = get().selectedVehicleId;
        if (!selectedVehicleId || !vehicles.some((v) => v.id === selectedVehicleId)) {
          selectedVehicleId = vehicles[0]?.id ?? null;
        }
        set({ vehicles, selectedVehicleId });
      },

      reloadEntries: async () => {
        const id = get().selectedVehicleId;
        if (!id) {
          set({ ...emptyEntries() });
          return;
        }
        const [fuelEntries, checkins, services] = await Promise.all([
          listFuelEntries(id),
          listCheckins(id),
          listServiceRecords(id),
        ]);
        set({ fuelEntries, checkins, services });
      },

      selectVehicle: async (id) => {
        set({ selectedVehicleId: id, ...emptyEntries() });
        await get().reloadEntries();
      },

      addVehicle: async (input) => {
        const id = await createVehicle(input);
        await get().reloadVehicles();
        if (get().vehicles.length === 1) await get().selectVehicle(id);
        return id;
      },
      editVehicle: async (id, input) => {
        await updateVehicle(id, input);
        await get().reloadVehicles();
      },
      removeVehicle: async (id) => {
        await deleteVehicle(id);
        const wasSelected = get().selectedVehicleId === id;
        await get().reloadVehicles();
        if (wasSelected) await get().reloadEntries();
      },

      addFuelEntry: async (input) => {
        const vehicleId = requireVehicle(get);
        await createFuelEntry({ ...input, vehicleId });
        set({ lastFullTank: input.isFullTank });
        await get().reloadEntries();
      },
      editFuelEntry: async (id, input) => {
        const vehicleId = requireVehicle(get);
        await updateFuelEntry(id, { ...input, vehicleId });
        await get().reloadEntries();
      },
      removeFuelEntry: async (id) => {
        await deleteFuelEntry(id);
        await get().reloadEntries();
      },

      addCheckin: async (input) => {
        const vehicleId = requireVehicle(get);
        await createCheckin({ ...input, vehicleId });
        await get().reloadEntries();
      },
      editCheckin: async (id, input) => {
        const vehicleId = requireVehicle(get);
        await updateCheckin(id, { ...input, vehicleId });
        await get().reloadEntries();
      },
      removeCheckin: async (id) => {
        await deleteCheckin(id);
        await get().reloadEntries();
      },

      addService: async (input) => {
        const vehicleId = requireVehicle(get);
        await createServiceRecord({ ...input, vehicleId });
        await get().reloadEntries();
      },
      editService: async (id, input) => {
        const vehicleId = requireVehicle(get);
        await updateServiceRecord(id, { ...input, vehicleId });
        await get().reloadEntries();
      },
      removeService: async (id) => {
        await deleteServiceRecord(id);
        await get().reloadEntries();
      },

      setLastFullTank: (v) => set({ lastFullTank: v }),
    }),
    {
      name: 'miletrack-prefs',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s): Persisted => ({
        selectedVehicleId: s.selectedVehicleId,
        lastFullTank: s.lastFullTank,
      }),
    },
  ),
);

function requireVehicle(get: () => AppState): number {
  const id = get().selectedVehicleId;
  if (!id) throw new Error('No vehicle selected');
  return id;
}

/** Convenience selector hook for the currently active vehicle. */
export function useSelectedVehicle(): Vehicle | null {
  return useAppStore((s) => s.vehicles.find((v) => v.id === s.selectedVehicleId) ?? null);
}
