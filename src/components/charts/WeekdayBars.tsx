import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme/theme';
import { fmtKm } from '@/utils/format';
import { Text } from '@/components/ui/Text';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function WeekdayBars({ kmByWeekday }: { kmByWeekday: number[] }) {
  const max = Math.max(...kmByWeekday, 1);
  return (
    <View style={styles.wrap}>
      {DAYS.map((d, i) => {
        const v = kmByWeekday[i] ?? 0;
        return (
          <View key={d} style={styles.row}>
            <Text variant="small" color={colors.textMuted} style={styles.day}>
              {d}
            </Text>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.max(2, (v / max) * 100)}%` },
                  i >= 5 && styles.weekend,
                ]}
              />
            </View>
            <Text variant="small" color={colors.textSecondary} style={styles.value}>
              {fmtKm(v)} km
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  day: { width: 34 },
  track: {
    flex: 1,
    height: 12,
    backgroundColor: colors.chartGrid,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.chartBar, borderRadius: radius.pill },
  weekend: { backgroundColor: colors.greenDim },
  value: { width: 64, textAlign: 'right' },
});
