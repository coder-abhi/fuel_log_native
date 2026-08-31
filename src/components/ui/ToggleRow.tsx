import { StyleSheet, Switch, View } from 'react-native';

import { colors, radius, spacing } from '@/theme/theme';
import { Text } from './Text';

interface Props {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}

export function ToggleRow({ label, hint, value, onValueChange }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.textCol}>
        <Text variant="bodyStrong">{label}</Text>
        {hint ? (
          <Text variant="small" color={colors.textMuted}>
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.borderStrong, true: colors.greenDim }}
        thumbColor={value ? colors.green : '#c9d1cc'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceInput,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  textCol: { flex: 1, gap: 2 },
});
