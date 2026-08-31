import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import type { TrendPoint } from '@/calc';
import { colors } from '@/theme/theme';
import { Text } from '@/components/ui/Text';

interface Props {
  points: TrendPoint[];
  height?: number;
}

export function TrendSparkline({ points, height = 90 }: Props) {
  const [width, setWidth] = useState(0);

  if (points.length < 2) {
    return (
      <Text variant="small" color={colors.textMuted}>
        Not enough fills yet to chart a mileage trend.
      </Text>
    );
  }

  const ys = points.map((p) => p.kmPerLitre);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || 1;
  const pad = 6;

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * (width - pad * 2) + pad;
    const y = height - pad - ((p.kmPerLitre - min) / span) * (height - pad * 2);
    return { x, y };
  });

  const d = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const last = coords[coords.length - 1];

  return (
    <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Path d={d} stroke={colors.chartLine} strokeWidth={2} fill="none" />
          <Circle cx={last.x} cy={last.y} r={3.5} fill={colors.chartLine} />
        </Svg>
      ) : null}
    </View>
  );
}
