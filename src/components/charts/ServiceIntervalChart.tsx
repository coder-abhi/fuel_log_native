import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import type { ServiceIntervalBucket } from '@/calc';
import { colors, spacing } from '@/theme/theme';
import { fmtMileage } from '@/utils/format';
import { Text } from '@/components/ui/Text';

interface Props {
  buckets: ServiceIntervalBucket[];
  height?: number;
}

export function ServiceIntervalChart({ buckets, height = 130 }: Props) {
  const [width, setWidth] = useState(0);

  const usable = buckets.filter((b) => b.kmPerLitre != null || b.ongoing);
  if (usable.length === 0) {
    return (
      <Text variant="small" color={colors.textMuted}>
        Add a few fuel fills to see mileage by service interval.
      </Text>
    );
  }

  const values = usable.map((b) => b.kmPerLitre ?? 0);
  const max = Math.max(...values, 1);
  const gap = 10;
  const barW = width > 0 ? Math.max(8, (width - gap * (usable.length - 1)) / usable.length) : 0;

  return (
    <View>
      <View style={styles.labelsTop}>
        {usable.map((b, i) => (
          <Text key={i} variant="tiny" color={colors.textSecondary} style={styles.cell}>
            {b.kmPerLitre != null ? fmtMileage(b.kmPerLitre) : '—'}
          </Text>
        ))}
      </View>
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            {usable.map((b, i) => {
              const v = b.kmPerLitre ?? 0;
              const h = Math.max(2, (v / max) * (height - 4));
              return (
                <Rect
                  key={i}
                  x={i * (barW + gap)}
                  y={height - h}
                  width={barW}
                  height={h}
                  rx={5}
                  fill={b.ongoing ? colors.chartBarOngoing : colors.chartBar}
                />
              );
            })}
          </Svg>
        ) : null}
      </View>
      <View style={styles.labelsBottom}>
        {usable.map((b, i) => (
          <Text key={i} variant="tiny" color={colors.textMuted} style={styles.cell}>
            {b.ongoing ? 'Now' : i + 1}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelsTop: { flexDirection: 'row', marginBottom: spacing.xs },
  labelsBottom: { flexDirection: 'row', marginTop: spacing.xs },
  cell: { flex: 1, textAlign: 'center' },
});
