import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { useAppStore, useSelectedVehicle } from '@/store/appStore';
import { colors, radius, spacing } from '@/theme/theme';
import { Text } from './ui/Text';

export function VehicleSwitcher() {
  const router = useRouter();
  const vehicles = useAppStore((s) => s.vehicles);
  const selectVehicle = useAppStore((s) => s.selectVehicle);
  const selected = useSelectedVehicle();
  const [open, setOpen] = useState(false);

  return (
    <>
      <View style={styles.bar}>
        <Pressable style={styles.switcher} onPress={() => setOpen(true)}>
          <MaterialCommunityIcons name="car-sports" size={18} color={colors.textSecondary} />
          <Text variant="h3" numberOfLines={1} style={styles.name}>
            {selected?.name ?? 'Select vehicle'}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSecondary} />
        </Pressable>
        <Pressable
          hitSlop={10}
          onPress={() => selected && router.push(`/vehicle/${selected.id}`)}
          style={styles.gear}
        >
          <MaterialCommunityIcons name="cog-outline" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text variant="tiny" color={colors.textMuted} style={styles.sheetTitle}>
              SWITCH VEHICLE
            </Text>
            {vehicles.map((v) => {
              const active = v.id === selected?.id;
              return (
                <Pressable
                  key={v.id}
                  style={styles.row}
                  onPress={() => {
                    selectVehicle(v.id);
                    setOpen(false);
                  }}
                >
                  <Text variant="bodyStrong" color={active ? colors.green : colors.textPrimary}>
                    {v.name}
                  </Text>
                  {active ? (
                    <MaterialCommunityIcons name="check" size={18} color={colors.green} />
                  ) : null}
                </Pressable>
              );
            })}
            <Pressable
              style={[styles.row, styles.addRow]}
              onPress={() => {
                setOpen(false);
                router.push('/vehicle/new');
              }}
            >
              <MaterialCommunityIcons name="plus" size={18} color={colors.green} />
              <Text variant="bodyStrong" color={colors.green}>
                Add vehicle
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  switcher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexShrink: 1,
  },
  name: { flexShrink: 1 },
  gear: { padding: spacing.xs },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-start',
    paddingTop: 110,
    paddingHorizontal: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  sheetTitle: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    gap: spacing.sm,
  },
  addRow: { justifyContent: 'flex-start', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
