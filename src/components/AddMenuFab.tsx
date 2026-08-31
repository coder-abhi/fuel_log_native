import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { useSheets } from '@/sheets/SheetsProvider';
import { colors, radius, spacing } from '@/theme/theme';
import { Text } from './ui/Text';

const ITEMS = [
  { key: 'fuel', label: 'Add fuel', icon: 'gas-station', tint: colors.green },
  { key: 'odometer', label: 'Log odometer', icon: 'speedometer', tint: colors.blue },
  { key: 'service', label: 'Log service', icon: 'wrench', tint: colors.orange },
] as const;

export function AddMenuFab() {
  const sheets = useSheets();
  const [open, setOpen] = useState(false);

  const run = (key: (typeof ITEMS)[number]['key']) => {
    setOpen(false);
    if (key === 'fuel') sheets.addFuel();
    else if (key === 'odometer') sheets.logOdometer();
    else sheets.logService();
  };

  return (
    <>
      <Pressable style={styles.fab} onPress={() => setOpen(true)} android_ripple={{ color: '#0006' }}>
        <MaterialCommunityIcons name="plus" size={28} color={colors.textInverse} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.menu}>
            {ITEMS.map((it) => (
              <Pressable key={it.key} style={styles.item} onPress={() => run(it.key)}>
                <MaterialCommunityIcons name={it.icon} size={20} color={it.tint} />
                <Text variant="bodyStrong">{it.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: spacing.xl,
    paddingBottom: 84,
  },
  menu: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: 2,
    minWidth: 200,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
  },
});
