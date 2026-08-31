import { Pressable, StyleSheet } from 'react-native';

import { colors, radius, spacing } from '@/theme/theme';
import { Text } from './Text';

interface Props {
  label: string;
  active: boolean;
  onPress: () => void;
}

export function Chip({ label, active, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.08)', borderless: false }}
      style={[styles.chip, active ? styles.active : styles.inactive]}
    >
      <Text
        variant="small"
        color={active ? colors.textInverse : colors.textSecondary}
        style={styles.label}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  active: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  inactive: {
    backgroundColor: 'transparent',
    borderColor: colors.borderStrong,
  },
  label: { fontWeight: '600' },
});
