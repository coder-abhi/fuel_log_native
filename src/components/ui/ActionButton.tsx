import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme/theme';
import { Text } from './Text';

type Tone = 'green' | 'blue' | 'orange';

interface Props {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tone: Tone;
  onPress: () => void;
  /** compact = shorter, used for the tertiary "Log service" action */
  compact?: boolean;
}

const TONE: Record<Tone, { bg: string; fg: string }> = {
  green: { bg: colors.green, fg: colors.textInverse },
  blue: { bg: colors.blue, fg: '#fff' },
  orange: { bg: colors.orange, fg: '#fff' },
};

export function ActionButton({ label, icon, tone, onPress, compact }: Props) {
  const t = TONE[tone];
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: 'rgba(0,0,0,0.18)' }}
      style={({ pressed }) => [
        styles.base,
        compact ? styles.compact : styles.tall,
        { backgroundColor: t.bg },
        pressed && styles.pressed,
      ]}
    >
      <View style={compact ? styles.rowCompact : styles.col}>
        <MaterialCommunityIcons name={icon} size={compact ? 20 : 26} color={t.fg} />
        <Text variant={compact ? 'bodyStrong' : 'h3'} color={t.fg}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tall: { paddingVertical: spacing.xl },
  compact: { paddingVertical: spacing.md },
  col: { alignItems: 'center', gap: spacing.sm },
  rowCompact: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pressed: { opacity: 0.88 },
});
