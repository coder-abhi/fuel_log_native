import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import type { VehicleType } from '@/calc';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Field, TextField } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { Text } from '@/components/ui/Text';
import { useAppStore } from '@/store/appStore';
import { colors, spacing } from '@/theme/theme';
import { isPositive, parseNum } from '@/utils/num';

const VEHICLE_TYPES: { key: VehicleType; label: string }[] = [
  { key: 'bike', label: 'Bike' },
  { key: 'car', label: 'Car' },
  { key: 'scooty', label: 'Scooty' },
];

export default function VehicleSettingsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const vehicles = useAppStore((s) => s.vehicles);
  const addVehicle = useAppStore((s) => s.addVehicle);
  const editVehicle = useAppStore((s) => s.editVehicle);
  const removeVehicle = useAppStore((s) => s.removeVehicle);

  const existing = useMemo(
    () => (isNew ? null : vehicles.find((v) => String(v.id) === id) ?? null),
    [vehicles, id, isNew],
  );

  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<VehicleType>(existing?.type ?? 'bike');
  const [tank, setTank] = useState(existing ? String(existing.tankCapacityLitres) : '');
  const [reserve, setReserve] = useState(
    existing ? String(existing.reserveThresholdLitres) : '',
  );
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const tankN = parseNum(tank);
  const reserveN = parseNum(reserve);
  const nameOk = name.trim().length > 0;
  const tankOk = isPositive(tankN);
  const reserveOk = reserveN != null && reserveN >= 0 && (tankN == null || reserveN < tankN);
  const canSave = nameOk && tankOk && reserveOk;

  if (!isNew && !existing) {
    return (
      <Screen>
        <Text color={colors.textMuted}>This vehicle no longer exists.</Text>
      </Screen>
    );
  }

  const save = async () => {
    setTouched(true);
    if (!canSave || tankN == null || reserveN == null) return;
    setSaving(true);
    const input = {
      name: name.trim(),
      type,
      tankCapacityLitres: tankN,
      reserveThresholdLitres: reserveN,
    };
    try {
      if (isNew) {
        await addVehicle(input);
        router.replace('/');
      } else {
        await editVehicle(existing!.id, input);
        router.back();
      }
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save', String(e));
    }
  };

  const confirmDelete = () => {
    if (!existing) return;
    Alert.alert(
      `Delete ${existing.name}?`,
      'This permanently deletes the vehicle and all its fuel, odometer and service entries.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await removeVehicle(existing.id);
            const remaining = useAppStore.getState().vehicles.length;
            if (remaining === 0) router.replace('/onboarding');
            else router.replace('/');
          },
        },
      ],
    );
  };

  return (
    <Screen bottomInset={spacing.xl}>
      <Text variant="h2">{isNew ? 'Add vehicle' : existing!.name}</Text>

      <TextField
        label="Name"
        required
        value={name}
        onChangeText={setName}
        placeholder="e.g. Verna SX"
        error={touched && !nameOk ? 'Give the vehicle a name' : null}
      />
      <Field label="Type" required>
        <Segmented options={VEHICLE_TYPES} value={type} onChange={setType} />
      </Field>
      <TextField
        label="Tank capacity (litres)"
        required
        keyboardType="numeric"
        value={tank}
        onChangeText={setTank}
        placeholder="e.g. 45"
        error={touched && !tankOk ? 'Enter the tank size in litres' : null}
      />
      <TextField
        label="Reserve threshold (litres)"
        required
        keyboardType="numeric"
        value={reserve}
        onChangeText={setReserve}
        placeholder="e.g. 4"
        hint="You'll be warned when estimated fuel drops below this"
        error={
          touched && !reserveOk
            ? 'Reserve must be 0 or more and less than the tank capacity'
            : null
        }
      />

      <Button
        label={isNew ? 'Create vehicle' : 'Save changes'}
        onPress={save}
        loading={saving}
        disabled={!canSave}
      />

      {!isNew ? (
        <View style={styles.dangerZone}>
          <Button
            label="Delete vehicle"
            variant="danger"
            icon="trash-can-outline"
            onPress={confirmDelete}
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dangerZone: { marginTop: spacing.xl },
});
