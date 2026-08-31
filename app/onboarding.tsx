import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import type { VehicleType } from '@/calc';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Field, TextField } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { Text } from '@/components/ui/Text';
import { useAppStore } from '@/store/appStore';
import { colors, radius, spacing } from '@/theme/theme';
import { isPositive, parseNum } from '@/utils/num';

const VEHICLE_TYPES: { key: VehicleType; label: string }[] = [
  { key: 'bike', label: 'Bike' },
  { key: 'car', label: 'Car' },
  { key: 'scooty', label: 'Scooty' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const ready = useAppStore((s) => s.ready);
  const hasVehicles = useAppStore((s) => s.vehicles.length > 0);
  const addVehicle = useAppStore((s) => s.addVehicle);

  const [name, setName] = useState('');
  const [type, setType] = useState<VehicleType>('bike');
  const [tank, setTank] = useState('');
  const [reserve, setReserve] = useState('');
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  // If a vehicle already exists (e.g. added elsewhere), don't block here.
  if (ready && hasVehicles) return <Redirect href="/" />;

  const tankN = parseNum(tank);
  const reserveN = parseNum(reserve);
  const nameOk = name.trim().length > 0;
  const tankOk = isPositive(tankN);
  const reserveOk = reserveN != null && reserveN >= 0 && (tankN == null || reserveN < tankN);
  const canSave = nameOk && tankOk && reserveOk;

  const create = async () => {
    setTouched(true);
    if (!canSave || tankN == null || reserveN == null) return;
    setSaving(true);
    try {
      await addVehicle({
        name: name.trim(),
        type,
        tankCapacityLitres: tankN,
        reserveThresholdLitres: reserveN,
      });
      router.replace('/');
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not create vehicle', String(e));
    }
  };

  return (
    <Screen bottomInset={spacing.xl}>
      <View style={styles.hero}>
        <View style={styles.logo}>
          <MaterialCommunityIcons name="gas-station" size={28} color={colors.green} />
        </View>
        <Text variant="h1">Welcome to MileTrack</Text>
        <Text variant="small" color={colors.textSecondary}>
          Add your vehicle to start tracking real mileage from your fill-ups and odometer
          readings.
        </Text>
      </View>

      <TextField
        label="Vehicle name"
        required
        value={name}
        onChangeText={setName}
        placeholder="e.g. Verna SX"
        autoFocus
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
        hint="Used later to warn you when fuel runs low"
        error={
          touched && !reserveOk
            ? 'Reserve must be 0 or more and less than the tank capacity'
            : null
        }
      />

      <Button label="Create vehicle" onPress={create} loading={saving} disabled={!canSave} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.sm, marginBottom: spacing.md, marginTop: spacing.xl },
  logo: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
});
