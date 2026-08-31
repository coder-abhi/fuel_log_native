import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme/theme';
import type { TimelineItem } from '@/utils/timeline';

const MAP: Record<
  TimelineItem['kind'],
  { icon: keyof typeof MaterialCommunityIcons.glyphMap; tint: string; bg: string }
> = {
  fuel: { icon: 'gas-station', tint: colors.green, bg: colors.greenSoft },
  odometer: { icon: 'speedometer', tint: colors.blue, bg: colors.blueSoft },
  service: { icon: 'wrench', tint: colors.orange, bg: colors.orangeSoft },
};

export function EntryIcon({ kind, size = 38 }: { kind: TimelineItem['kind']; size?: number }) {
  const m = MAP[kind];
  return (
    <View
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: radius.md, backgroundColor: m.bg },
      ]}
    >
      <MaterialCommunityIcons name={m.icon} size={size * 0.5} color={m.tint} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
