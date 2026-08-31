import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme/theme';
import { Text } from './Text';

interface Props {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  icon?: ReactNode;
  /** override the value colour (e.g. red when fuel is at/below reserve) */
  valueColor?: string;
}

export function StatCard({ label, value, unit, hint, icon, valueColor }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.labelRow}>
        <Text variant="tiny" color={colors.textMuted} style={styles.label}>
          {label.toUpperCase()}
        </Text>
        {icon}
      </View>
      <View style={styles.valueRow}>
        <Text variant="h1" color={valueColor}>
          {value}
        </Text>
        {unit ? (
          <Text variant="small" color={colors.textSecondary} style={styles.unit}>
            {unit}
          </Text>
        ) : null}
      </View>
      {hint ? (
        <Text variant="small" color={colors.textMuted}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
    minHeight: 84,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: { letterSpacing: 0.5 },
  valueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  unit: { marginBottom: 3 },
});
