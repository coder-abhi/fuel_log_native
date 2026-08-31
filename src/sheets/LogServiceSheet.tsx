import { BottomSheetModal, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import type { ServiceRecord } from '@/calc';
import { Button } from '@/components/ui/Button';
import { DateTimeField } from '@/components/ui/DateTimeField';
import { TextField } from '@/components/ui/Field';
import { useAppStore } from '@/store/appStore';
import { useVehicleStats } from '@/hooks/useVehicleStats';
import { fmtKm } from '@/utils/format';
import { isPositive, parseNum } from '@/utils/num';
import { FormSheet } from './FormSheet';

interface Props {
  target: ServiceRecord | null | undefined;
  openNonce: number;
  onClose: () => void;
}

export const LogServiceSheet = forwardRef<BottomSheetModal, Props>(function LogServiceSheet(
  { target, openNonce, onClose },
  ref,
) {
  const addService = useAppStore((s) => s.addService);
  const editService = useAppStore((s) => s.editService);
  const removeService = useAppStore((s) => s.removeService);
  const { lastKnownOdometer } = useVehicleStats();

  const editing = !!target;
  const [odometer, setOdometer] = useState('');
  const [servicedAt, setServicedAt] = useState(new Date().toISOString());
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  const seed = useCallback(() => {
    setTouched(false);
    setSubmitting(false);
    if (target) {
      setOdometer(target.odometerKm != null ? String(target.odometerKm) : '');
      setServicedAt(target.servicedAt);
      setCost(target.cost != null ? String(target.cost) : '');
      setNotes(target.notes ?? '');
    } else {
      setOdometer('');
      setServicedAt(new Date().toISOString());
      setCost('');
      setNotes('');
    }
  }, [target]);

  useEffect(() => {
    if (openNonce > 0) seed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openNonce]);

  const odo = parseNum(odometer);
  const odoProvided = odometer.trim() !== '';
  // Odometer is optional; only validate it when the user actually typed something.
  const canSubmit = !odoProvided || isPositive(odo);

  const submit = async () => {
    setTouched(true);
    if (!canSubmit) return;
    setSubmitting(true);
    const payload = {
      odometerKm: odoProvided ? odo : null,
      servicedAt,
      cost: parseNum(cost),
      notes: notes.trim() ? notes.trim() : null,
    };
    try {
      if (target) await editService(target.id, payload);
      else await addService(payload);
      onClose();
    } catch (e) {
      setSubmitting(false);
      Alert.alert('Could not save', String(e));
    }
  };

  const confirmDelete = () => {
    if (!target) return;
    Alert.alert(
      'Delete this service record?',
      'Service-interval mileage will be recalculated.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await removeService(target.id);
            onClose();
          },
        },
      ],
    );
  };

  return (
    <FormSheet
      ref={ref}
      title={editing ? 'Edit service' : 'Log service'}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={editing ? 'Save changes' : 'Save'}
      submitting={submitting}
      canSubmit={canSubmit}
      destructive={
        editing ? (
          <Button
            label="Delete record"
            variant="danger"
            icon="trash-can-outline"
            onPress={confirmDelete}
          />
        ) : undefined
      }
    >
      <DateTimeField label="Date" value={servicedAt} onChange={setServicedAt} />
      <TextField
        label="Odometer (km, optional)"
        inputComponent={BottomSheetTextInput}
        keyboardType="numeric"
        value={odometer}
        onChangeText={setOdometer}
        placeholder="e.g. 24563"
        error={
          touched && odoProvided && !isPositive(odo)
            ? 'Enter a valid odometer reading'
            : null
        }
        hint={lastKnownOdometer != null ? `Last: ${fmtKm(lastKnownOdometer)} km` : undefined}
      />
      <TextField
        label="Cost (optional)"
        inputComponent={BottomSheetTextInput}
        keyboardType="numeric"
        value={cost}
        onChangeText={setCost}
        placeholder="₹ 0.00"
      />
      <TextField
        label="Notes (optional)"
        inputComponent={BottomSheetTextInput}
        value={notes}
        onChangeText={setNotes}
        placeholder="e.g. oil change, full service, filters"
        multiline
      />
    </FormSheet>
  );
});
