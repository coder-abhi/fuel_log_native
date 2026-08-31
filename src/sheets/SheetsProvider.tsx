import { BottomSheetModal } from '@gorhom/bottom-sheet';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { FuelEntry, OdometerCheckin, ServiceRecord } from '@/calc';
import { AddFuelSheet } from './AddFuelSheet';
import { LogOdometerSheet } from './LogOdometerSheet';
import { LogServiceSheet } from './LogServiceSheet';

/** undefined = never opened, null = creating new, object = editing that row */
export type SheetTarget<T> = T | null | undefined;

interface SheetsApi {
  addFuel: () => void;
  editFuel: (entry: FuelEntry) => void;
  logOdometer: () => void;
  editOdometer: (checkin: OdometerCheckin) => void;
  logService: () => void;
  editService: (record: ServiceRecord) => void;
}

const Ctx = createContext<SheetsApi | null>(null);

export function useSheets(): SheetsApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSheets must be used inside <SheetsProvider>');
  return v;
}

export function SheetsProvider({ children }: { children: ReactNode }) {
  const fuelRef = useRef<BottomSheetModal>(null);
  const odoRef = useRef<BottomSheetModal>(null);
  const svcRef = useRef<BottomSheetModal>(null);

  const [fuel, setFuel] = useState<{ target: SheetTarget<FuelEntry>; nonce: number }>({
    target: undefined,
    nonce: 0,
  });
  const [odo, setOdo] = useState<{ target: SheetTarget<OdometerCheckin>; nonce: number }>({
    target: undefined,
    nonce: 0,
  });
  const [svc, setSvc] = useState<{ target: SheetTarget<ServiceRecord>; nonce: number }>({
    target: undefined,
    nonce: 0,
  });

  const api = useMemo<SheetsApi>(
    () => ({
      addFuel: () => {
        setFuel((s) => ({ target: null, nonce: s.nonce + 1 }));
        fuelRef.current?.present();
      },
      editFuel: (entry) => {
        setFuel((s) => ({ target: entry, nonce: s.nonce + 1 }));
        fuelRef.current?.present();
      },
      logOdometer: () => {
        setOdo((s) => ({ target: null, nonce: s.nonce + 1 }));
        odoRef.current?.present();
      },
      editOdometer: (checkin) => {
        setOdo((s) => ({ target: checkin, nonce: s.nonce + 1 }));
        odoRef.current?.present();
      },
      logService: () => {
        setSvc((s) => ({ target: null, nonce: s.nonce + 1 }));
        svcRef.current?.present();
      },
      editService: (record) => {
        setSvc((s) => ({ target: record, nonce: s.nonce + 1 }));
        svcRef.current?.present();
      },
    }),
    [],
  );

  const closeFuel = useCallback(() => fuelRef.current?.dismiss(), []);
  const closeOdo = useCallback(() => odoRef.current?.dismiss(), []);
  const closeSvc = useCallback(() => svcRef.current?.dismiss(), []);

  return (
    <Ctx.Provider value={api}>
      {children}
      <AddFuelSheet ref={fuelRef} target={fuel.target} openNonce={fuel.nonce} onClose={closeFuel} />
      <LogOdometerSheet ref={odoRef} target={odo.target} openNonce={odo.nonce} onClose={closeOdo} />
      <LogServiceSheet ref={svcRef} target={svc.target} openNonce={svc.nonce} onClose={closeSvc} />
    </Ctx.Provider>
  );
}
