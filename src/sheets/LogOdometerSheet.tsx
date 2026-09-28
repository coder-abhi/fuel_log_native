import { BottomSheetModal, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import type { OdometerCheckin } from '@/calc';
import { nearestOdometerNeighbors, odometerOrderViolation, type OdometerPoint } from '@/calc';
import { Button } from '@/components/ui/Button';
import { DateTimeField } from '@/components/ui/DateTimeField';
import { TextField } from '@/components/ui/Field';
import { FuelLevelSlider } from '@/components/ui/FuelLevelSlider';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { useAppStore } from '@/store/appStore';
import { useVehicleStats } from '@/hooks/useVehicleStats';
import { fmtDate, fmtKm } from '@/utils/format';
import { isPositive, parseNum } from '@/utils/num';
import { FormSheet } from './FormSheet';

interface Props {
  target: OdometerCheckin | null | undefined;
  openNonce: number;
  onClose: () => void;
}

const DEFAULT_FUEL_PERCENT = 50;

export const LogOdometerSheet = forwardRef<BottomSheetModal, Props>(function LogOdometerSheet(
  { target, openNonce, onClose },
  ref,
) {
  const addCheckin = useAppStore((s) => s.addCheckin);
  const editCheckin = useAppStore((s) => s.editCheckin);
  const removeCheckin = useAppStore((s) => s.removeCheckin);
  const fuelEntries = useAppStore((s) => s.fuelEntries);
  const checkins = useAppStore((s) => s.checkins);
  const services = useAppStore((s) => s.services);
  const { lastKnownOdometer } = useVehicleStats();

  const editing = !!target;
  const [odometer, setOdometer] = useState('');
  const [checkedAt, setCheckedAt] = useState(new Date().toISOString());
  const [notes, setNotes] = useState('');
  const [fuelTracked, setFuelTracked] = useState(false);
  const [fuelPercent, setFuelPercent] = useState(DEFAULT_FUEL_PERCENT);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  const seed = useCallback(() => {
    setTouched(false);
    setSubmitting(false);
    if (target) {
      setOdometer(String(target.odometerKm));
      setCheckedAt(target.checkedAt);
      setNotes(target.notes ?? '');
      setFuelTracked(target.fuelPercent != null);
      setFuelPercent(target.fuelPercent ?? DEFAULT_FUEL_PERCENT);
    } else {
      setOdometer(lastKnownOdometer != null ? String(lastKnownOdometer) : '');
      setCheckedAt(new Date().toISOString());
      setNotes('');
      setFuelTracked(false);
      setFuelPercent(DEFAULT_FUEL_PERCENT);
    }
  }, [target, lastKnownOdometer]);

  useEffect(() => {
    if (openNonce > 0) seed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openNonce]);

  const odo = parseNum(odometer);

  // The odometer only ever goes up. Check against BOTH chronological
  // neighbors (not just the single latest reading) so a backdated entry can't
  // land below an earlier reading or above a later one either.
  const neighborPoints: OdometerPoint[] = [
    ...fuelEntries
      .filter((e) => e.odometerKm != null)
      .map((e) => ({ at: e.filledAt, odometerKm: e.odometerKm! })),
    ...checkins
      .filter((c) => c.id !== target?.id)
      .map((c) => ({ at: c.checkedAt, odometerKm: c.odometerKm })),
    ...services
      .filter((s) => s.odometerKm != null)
      .map((s) => ({ at: s.servicedAt, odometerKm: s.odometerKm! })),
  ];
  const neighbors = nearestOdometerNeighbors(neighborPoints, checkedAt);
  const orderViolation = odo != null ? odometerOrderViolation(odo, neighbors) : null;
  const canSubmit = isPositive(odo) && !orderViolation;

  const submit = async () => {
    setTouched(true);
    if (odo == null || !canSubmit) return;
    setSubmitting(true);
    const payload = {
      odometerKm: odo,
      checkedAt,
      notes: notes.trim() ? notes.trim() : null,
      fuelPercent: fuelTracked ? fuelPercent : null,
    };
    try {
      if (target) await editCheckin(target.id, payload);
      else await addCheckin(payload);
      onClose();
    } catch (e) {
      setSubmitting(false);
      Alert.alert('Could not save', String(e));
    }
  };

  const confirmDelete = () => {
    if (!target) return;
    Alert.alert('Delete this odometer reading?', 'Stats will be recalculated.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removeCheckin(target.id);
          onClose();
        },
      },
    ]);
  };

  return (
    <FormSheet
      ref={ref}
      title={editing ? 'Edit odometer' : 'Log odometer'}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={editing ? 'Save changes' : 'Save'}
      submitting={submitting}
      canSubmit={canSubmit}
      destructive={
        editing ? (
          <Button
            label="Delete reading"
            variant="danger"
            icon="trash-can-outline"
            onPress={confirmDelete}
          />
        ) : undefined
      }
    >
      <TextField
        label="Odometer (km)"
        required
        autoFocus={!editing}
        inputComponent={BottomSheetTextInput}
        keyboardType="numeric"
        value={odometer}
        onChangeText={setOdometer}
        placeholder="e.g. 24563"
        error={
          touched && !isPositive(odo)
            ? 'Enter a valid odometer reading'
            : touched && orderViolation === 'below-earlier' && neighbors.prev
              ? `Can't be lower than ${fmtKm(neighbors.prev.odometerKm)} km, logged on ${fmtDate(neighbors.prev.at)}.`
              : touched && orderViolation === 'above-later' && neighbors.next
                ? `Can't be higher than ${fmtKm(neighbors.next.odometerKm)} km, logged on ${fmtDate(neighbors.next.at)}.`
                : null
        }
        hint={lastKnownOdometer != null ? `Last: ${fmtKm(lastKnownOdometer)} km` : undefined}
      />
      <DateTimeField label="Date" value={checkedAt} onChange={setCheckedAt} />

      <ToggleRow
        label="Track approximate fuel level"
        hint="Slide to roughly how full the tank is right now"
        value={fuelTracked}
        onValueChange={setFuelTracked}
      />
      {fuelTracked ? (
        <FuelLevelSlider value={fuelPercent} onChange={setFuelPercent} />
      ) : null}

      <TextField
        label="Note (optional)"
        inputComponent={BottomSheetTextInput}
        value={notes}
        onChangeText={setNotes}
        placeholder="e.g. long drive, highway, city"
        multiline
      />
    </FormSheet>
  );
});
