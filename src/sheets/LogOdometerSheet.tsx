import { BottomSheetModal, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import type { OdometerCheckin } from '@/calc';
import { Button } from '@/components/ui/Button';
import { DateTimeField } from '@/components/ui/DateTimeField';
import { TextField } from '@/components/ui/Field';
import { useAppStore } from '@/store/appStore';
import { useVehicleStats } from '@/hooks/useVehicleStats';
import { fmtKm } from '@/utils/format';
import { isPositive, parseNum } from '@/utils/num';
import { FormSheet } from './FormSheet';

interface Props {
  target: OdometerCheckin | null | undefined;
  openNonce: number;
  onClose: () => void;
}

export const LogOdometerSheet = forwardRef<BottomSheetModal, Props>(function LogOdometerSheet(
  { target, openNonce, onClose },
  ref,
) {
  const addCheckin = useAppStore((s) => s.addCheckin);
  const editCheckin = useAppStore((s) => s.editCheckin);
  const removeCheckin = useAppStore((s) => s.removeCheckin);
  const { lastKnownOdometer, lastKnownOdometerAt } = useVehicleStats();

  const editing = !!target;
  const [odometer, setOdometer] = useState('');
  const [checkedAt, setCheckedAt] = useState(new Date().toISOString());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  const seed = useCallback(() => {
    setTouched(false);
    setSubmitting(false);
    if (target) {
      setOdometer(String(target.odometerKm));
      setCheckedAt(target.checkedAt);
      setNotes(target.notes ?? '');
    } else {
      setOdometer(lastKnownOdometer != null ? String(lastKnownOdometer) : '');
      setCheckedAt(new Date().toISOString());
      setNotes('');
    }
  }, [target, lastKnownOdometer]);

  useEffect(() => {
    if (openNonce > 0) seed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openNonce]);

  const odo = parseNum(odometer);
  // A fresh reading dated at/after the latest one can't be lower — the odometer
  // only goes up. Corrections go through editing the earlier entry in History.
  const goesBackwards =
    !editing &&
    lastKnownOdometer != null &&
    odo != null &&
    odo < lastKnownOdometer &&
    (lastKnownOdometerAt == null ||
      Date.parse(checkedAt) >= Date.parse(lastKnownOdometerAt));
  const canSubmit = isPositive(odo) && !goesBackwards;

  const submit = async () => {
    setTouched(true);
    if (odo == null || !canSubmit) return;
    setSubmitting(true);
    const payload = {
      odometerKm: odo,
      checkedAt,
      notes: notes.trim() ? notes.trim() : null,
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
            : goesBackwards
              ? `Odometer is already at ${fmtKm(lastKnownOdometer)} km. To fix an earlier reading, edit it in History.`
              : null
        }
        hint={lastKnownOdometer != null ? `Last: ${fmtKm(lastKnownOdometer)} km` : undefined}
      />
      <DateTimeField label="Date" value={checkedAt} onChange={setCheckedAt} />
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
