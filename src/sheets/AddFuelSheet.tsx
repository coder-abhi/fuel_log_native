import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BottomSheetModal, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import type { FuelEntry } from '@/calc';
import { lifetimeMileage, sinceLastServiceMileage } from '@/calc';
import { Button } from '@/components/ui/Button';
import { DateTimeField } from '@/components/ui/DateTimeField';
import { TextField } from '@/components/ui/Field';
import { Text } from '@/components/ui/Text';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { useAppStore, useSelectedVehicle } from '@/store/appStore';
import { useVehicleStats } from '@/hooks/useVehicleStats';
import { colors, radius, spacing } from '@/theme/theme';
import { fmtKm, fmtLitres } from '@/utils/format';
import { isNonNegative, isPositive, parseNum } from '@/utils/num';
import { FormSheet } from './FormSheet';

type MissedMode = 'none' | 'approx';

interface Props {
  target: FuelEntry | null | undefined;
  openNonce: number;
  onClose: () => void;
}

export const AddFuelSheet = forwardRef<BottomSheetModal, Props>(function AddFuelSheet(
  { target, openNonce, onClose },
  ref,
) {
  const addFuelEntry = useAppStore((s) => s.addFuelEntry);
  const editFuelEntry = useAppStore((s) => s.editFuelEntry);
  const removeFuelEntry = useAppStore((s) => s.removeFuelEntry);
  const lastFullTank = useAppStore((s) => s.lastFullTank);
  const fuelEntries = useAppStore((s) => s.fuelEntries);
  const services = useAppStore((s) => s.services);
  const { lastKnownOdometer, lastKnownOdometerAt } = useVehicleStats();
  const selectedVehicle = useSelectedVehicle();
  const tankCapacity = selectedVehicle?.tankCapacityLitres ?? null;

  const editing = !!target;

  const [odometer, setOdometer] = useState('');
  const [litres, setLitres] = useState('');
  const [filledAt, setFilledAt] = useState(new Date().toISOString());
  const [isFull, setIsFull] = useState(true);
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [missed, setMissed] = useState<MissedMode>('none');
  const [showMissed, setShowMissed] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  const seed = useCallback(() => {
    setTouched(false);
    setSubmitting(false);
    if (target) {
      setOdometer(String(target.odometerKm));
      setLitres(target.litresFilled != null ? String(target.litresFilled) : '');
      setFilledAt(target.filledAt);
      setIsFull(target.isFullTank);
      setCost(target.cost != null ? String(target.cost) : '');
      setNotes(target.notes ?? '');
      setMissed(target.excludedFromMileage || target.isApproximate ? 'approx' : 'none');
      setShowMissed(target.excludedFromMileage || target.isApproximate);
      setHintDismissed(true);
    } else {
      setOdometer(lastKnownOdometer != null ? String(lastKnownOdometer) : '');
      setLitres('');
      setFilledAt(new Date().toISOString());
      setIsFull(lastFullTank);
      setCost('');
      setNotes('');
      setMissed('none');
      setShowMissed(false);
      setHintDismissed(false);
    }
  }, [target, lastKnownOdometer, lastFullTank]);

  // Re-seed the form each time the sheet is opened (provider bumps openNonce).
  useEffect(() => {
    if (openNonce > 0) seed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openNonce]);

  const odo = parseNum(odometer);
  const lit = parseNum(litres);
  // The very first fuel entry may legitimately be logged at 0 km.
  const isFirstEntry =
    (target ? fuelEntries.filter((e) => e.id !== target.id) : fuelEntries).length === 0;
  const odoValid = isFirstEntry ? isNonNegative(odo) : isPositive(odo);
  // The odometer only ever goes up. A new fill dated at/after the latest reading
  // can't have a lower odometer — that's a typo, or a job for editing History.
  const goesBackwards =
    !editing &&
    lastKnownOdometer != null &&
    odo != null &&
    odo < lastKnownOdometer &&
    (lastKnownOdometerAt == null ||
      Date.parse(filledAt) >= Date.parse(lastKnownOdometerAt));
  const litresRequired = missed !== 'approx';
  const litValid = litresRequired ? isPositive(lit) : true;
  // Can't put more fuel in than the tank holds — the litres or the configured
  // tank capacity is wrong.
  const overCapacity = tankCapacity != null && lit != null && lit > tankCapacity;
  const canSubmit = odoValid && litValid && !goesBackwards && !overCapacity;

  // Heuristic: does this interval imply an implausibly high mileage?
  const prevOdo = lastPrevOdometer(fuelEntries, target?.id);
  const recentAvg =
    sinceLastServiceMileage(fuelEntries, services).kmPerLitre ??
    lifetimeMileage(fuelEntries).kmPerLitre;
  const impliedMileage =
    prevOdo != null && odo != null && odoValid && isPositive(lit) && odo > prevOdo
      ? (odo - prevOdo) / lit
      : null;
  const missedFillLikely =
    !editing &&
    missed === 'none' &&
    recentAvg != null &&
    impliedMileage != null &&
    impliedMileage > recentAvg * 1.5;

  // Auto-reveal the missed-fill options when the heuristic fires (once, unless
  // the user has waved the hint away).
  useEffect(() => {
    if (missedFillLikely && !showMissed && !hintDismissed) {
      setShowMissed(true);
      setMissed('approx');
    }
  }, [missedFillLikely, showMissed, hintDismissed]);

  const submit = async () => {
    setTouched(true);
    if (!canSubmit || odo == null) return;
    setSubmitting(true);
    const approx = missed === 'approx';
    const hasLitres = isPositive(lit);
    const payload = {
      odometerKm: odo,
      litresFilled: approx ? (hasLitres ? lit : null) : lit,
      isFullTank: approx ? false : isFull,
      isApproximate: approx && hasLitres,
      // No estimate given for the missed fill — keep this interval out of mileage.
      excludedFromMileage: approx && !hasLitres,
      cost: parseNum(cost),
      filledAt,
      notes: notes.trim() ? notes.trim() : null,
    };
    try {
      if (target) await editFuelEntry(target.id, payload);
      else await addFuelEntry(payload);
      onClose();
    } catch (e) {
      setSubmitting(false);
      Alert.alert('Could not save', String(e));
    }
  };

  const confirmDelete = () => {
    if (!target) return;
    Alert.alert('Delete this fuel entry?', 'Mileage and stats will be recalculated.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removeFuelEntry(target.id);
          onClose();
        },
      },
    ]);
  };

  return (
    <FormSheet
      ref={ref}
      title={editing ? 'Edit fuel' : 'Add fuel'}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={editing ? 'Save changes' : 'Save'}
      submitting={submitting}
      canSubmit={canSubmit}
      destructive={
        editing ? (
          <Button label="Delete entry" variant="danger" icon="trash-can-outline" onPress={confirmDelete} />
        ) : undefined
      }
    >
      <TextField
        label="Odometer (km)"
        required
        inputComponent={BottomSheetTextInput}
        keyboardType="numeric"
        value={odometer}
        onChangeText={setOdometer}
        placeholder="e.g. 24563"
        error={
          touched && !odoValid
            ? 'Enter a valid odometer reading'
            : goesBackwards
              ? `Odometer is already at ${fmtKm(lastKnownOdometer)} km. To fix an earlier reading, edit it in History.`
              : null
        }
        hint={lastKnownOdometer != null ? `Last: ${fmtKm(lastKnownOdometer)} km` : undefined}
      />

      <TextField
        label={missed === 'approx' ? 'Approx. litres for missed fill (optional)' : 'Litres added'}
        required={litresRequired}
        autoFocus={!editing}
        inputComponent={BottomSheetTextInput}
        keyboardType="numeric"
        value={litres}
        onChangeText={setLitres}
        placeholder="e.g. 5.21"
        error={
          touched && !litValid
            ? 'Enter the litres you filled'
            : overCapacity
              ? `More than the ${fmtLitres(tankCapacity, 0)} L tank capacity. Re-check the litres, or the tank size in vehicle settings.`
              : null
        }
      />

      <DateTimeField label="Date" value={filledAt} onChange={setFilledAt} />

      <ToggleRow
        label="Full tank / almost full tank"
        hint="Filling right up gives you a more accurate mileage"
        value={missed === 'approx' ? false : isFull}
        onValueChange={(v) => {
          setIsFull(v);
          if (missed === 'approx') setMissed('none');
        }}
      />

      {missedFillLikely ? (
        <View style={styles.notice}>
          <MaterialCommunityIcons name="alert-outline" size={16} color={colors.orange} />
          <Text variant="small" color={colors.textSecondary} style={styles.noticeText}>
            This gap implies unusually high mileage. Did you miss a fill-up before this?
          </Text>
        </View>
      ) : null}

      {!showMissed ? (
        <Pressable
          onPress={() => {
            setShowMissed(true);
            setMissed('approx');
          }}
          style={styles.link}
        >
          <MaterialCommunityIcons name="plus-circle-outline" size={16} color={colors.green} />
          <Text variant="small" color={colors.green}>
            I missed a fill-up before this
          </Text>
        </Pressable>
      ) : (
        <View style={styles.missedBox}>
          <Text variant="small" color={colors.textSecondary}>
            Put a rough estimate of the litres from the fill-up you forgot to log in the
            field above. Leave it blank if you’re not sure — this interval is then skipped
            from mileage, but its distance still counts.
          </Text>
          <Pressable
            onPress={() => {
              setShowMissed(false);
              setMissed('none');
              setHintDismissed(true);
            }}
          >
            <Text variant="small" color={colors.textMuted}>
              Never mind
            </Text>
          </Pressable>
        </View>
      )}

      <TextField
        label="Cost (optional)"
        inputComponent={BottomSheetTextInput}
        keyboardType="numeric"
        value={cost}
        onChangeText={setCost}
        placeholder="₹ 0.00"
        style={styles.deemph}
      />
    </FormSheet>
  );
});

const styles = StyleSheet.create({
  deemph: { opacity: 0.9 },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.orangeSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  noticeText: { flex: 1 },
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  missedBox: {
    gap: spacing.sm,
    backgroundColor: colors.surfaceInput,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    padding: spacing.md,
  },
});

/** Previous odometer (chronologically) among fuel entries, excluding `skipId`. */
function lastPrevOdometer(entries: readonly FuelEntry[], skipId?: number): number | null {
  const sorted = [...entries]
    .filter((e) => e.id !== skipId)
    .sort((a, b) => Date.parse(a.filledAt) - Date.parse(b.filledAt));
  const last = sorted[sorted.length - 1];
  return last ? last.odometerKm : null;
}
