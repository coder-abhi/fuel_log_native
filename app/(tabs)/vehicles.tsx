import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { pickBackupFile, shareBackupFile } from '@/backup/backup';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useAppStore } from '@/store/appStore';
import { colors, radius, spacing } from '@/theme/theme';
import { fmtLitres } from '@/utils/format';

export default function VehiclesScreen() {
  const router = useRouter();
  const vehicles = useAppStore((s) => s.vehicles);
  const selectedId = useAppStore((s) => s.selectedVehicleId);
  const selectVehicle = useAppStore((s) => s.selectVehicle);
  const restoreFromBackup = useAppStore((s) => s.restoreFromBackup);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const applyBackup = async (backup: Parameters<typeof restoreFromBackup>[0]) => {
    setImporting(true);
    try {
      await restoreFromBackup(backup);
    } catch (e) {
      Alert.alert('Could not import backup', String(e));
    } finally {
      setImporting(false);
    }
  };

  const importBackup = async () => {
    setImporting(true);
    const picked = await pickBackupFile();
    setImporting(false);
    if (picked.status === 'canceled') return;
    if (picked.status === 'invalid') {
      Alert.alert('Not a MileTrack backup', 'That file isn’t a MileTrack backup (.json).');
      return;
    }
    if (vehicles.length > 0) {
      Alert.alert(
        'Replace current data?',
        'Importing this backup will permanently replace all vehicles and entries currently on this device.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace', style: 'destructive', onPress: () => applyBackup(picked.backup) },
        ],
      );
    } else {
      await applyBackup(picked.backup);
    }
  };

  const exportBackup = async () => {
    setExporting(true);
    try {
      await shareBackupFile();
    } catch (e) {
      Alert.alert('Could not export backup', String(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Screen bottomInset={spacing.xl}>
      <Text variant="h1">Vehicles</Text>

      {vehicles.map((v) => {
        const active = v.id === selectedId;
        return (
          <Pressable
            key={v.id}
            style={styles.card}
            onPress={() => {
              selectVehicle(v.id);
              router.push(`/vehicle/${v.id}`);
            }}
          >
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons name="car-sports" size={22} color={colors.textSecondary} />
            </View>
            <View style={styles.body}>
              <View style={styles.nameRow}>
                <Text variant="h3">{v.name}</Text>
                {active ? (
                  <View style={styles.badge}>
                    <Text variant="tiny" color={colors.textInverse}>
                      ACTIVE
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text variant="small" color={colors.textMuted}>
                Tank {fmtLitres(v.tankCapacityLitres, 0)} L · Reserve{' '}
                {fmtLitres(v.reserveThresholdLitres, 1)} L
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
          </Pressable>
        );
      })}

      <Button
        label="Add vehicle"
        variant="secondary"
        icon="plus"
        onPress={() => router.push('/vehicle/new')}
      />

      <View style={styles.backupRow}>
        <Button
          label="Export backup"
          variant="ghost"
          icon="tray-arrow-up"
          loading={exporting}
          onPress={exportBackup}
          style={styles.backupButton}
        />
        <Button
          label="Import backup"
          variant="ghost"
          icon="tray-arrow-down"
          loading={importing}
          onPress={importBackup}
          style={styles.backupButton}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backupRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  backupButton: { flex: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: {
    backgroundColor: colors.green,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
