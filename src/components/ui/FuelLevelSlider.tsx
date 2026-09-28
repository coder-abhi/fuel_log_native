import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors, spacing } from '@/theme/theme';
import { Text } from './Text';

interface Props {
  /** 0-100, always a multiple of STEP */
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

const THUMB = 24;
const HIT_HEIGHT = 32;
const BAR_HEIGHT = 6;
const STEP = 5;

function clamp(v: number, lo: number, hi: number): number {
  'worklet';
  return Math.max(lo, Math.min(hi, v));
}

function snapToStep(v: number): number {
  'worklet';
  return clamp(Math.round(v / STEP) * STEP, 0, 100);
}

/**
 * Approximate tank-fill slider, snapped to 5% steps. Full right = full tank,
 * full left = empty. Drag tracking and the fill/thumb position run entirely
 * on the UI thread via reanimated + gesture-handler (already hard
 * dependencies for the bottom sheet) — only a snapped-step CHANGE is sent
 * back to React state, so dragging never re-renders the rest of the form.
 */
export function FuelLevelSlider({ value, onChange, disabled }: Props) {
  const trackWidth = useSharedValue(0);
  const percent = useSharedValue(value);
  const isDragging = useSharedValue(false);

  // Keep in sync with external changes (seeding the form) while not dragging.
  useEffect(() => {
    if (!isDragging.value) percent.value = withTiming(value, { duration: 120 });
  }, [value, percent, isDragging]);

  const commit = (snapped: number) => {
    if (snapped !== value) onChange(snapped);
  };

  const updateFromX = (x: number) => {
    'worklet';
    const w = trackWidth.value;
    if (w <= 0) return;
    const snapped = snapToStep((x / w) * 100);
    if (snapped !== percent.value) {
      percent.value = withTiming(snapped, { duration: 90 });
      runOnJS(commit)(snapped);
    }
  };

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .onBegin((e) => {
      isDragging.value = true;
      updateFromX(e.x);
    })
    .onUpdate((e) => {
      updateFromX(e.x);
    })
    .onFinalize(() => {
      isDragging.value = false;
    });

  const fillStyle = useAnimatedStyle(() => ({ width: `${percent.value}%` }));
  const thumbStyle = useAnimatedStyle(() => ({
    left: trackWidth.value > 0 ? (percent.value / 100) * trackWidth.value - THUMB / 2 : -THUMB / 2,
  }));

  return (
    <View style={disabled ? styles.disabled : undefined}>
      <View style={styles.readoutRow}>
        <Text variant="small" color={colors.textMuted}>
          Empty
        </Text>
        <Text variant="bodyStrong" color={colors.textPrimary}>
          {value}% full
        </Text>
        <Text variant="small" color={colors.textMuted}>
          Full
        </Text>
      </View>
      <GestureDetector gesture={pan}>
        <View
          style={styles.hitArea}
          onLayout={(e) => {
            trackWidth.value = e.nativeEvent.layout.width;
          }}
        >
          <View style={styles.bar}>
            <Animated.View style={[styles.fill, fillStyle]} />
          </View>
          <Animated.View style={[styles.thumb, thumbStyle]} />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.4 },
  readoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  hitArea: {
    height: HIT_HEIGHT,
    justifyContent: 'center',
  },
  bar: {
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    backgroundColor: colors.surfaceInput,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: BAR_HEIGHT / 2,
    backgroundColor: colors.green,
  },
  thumb: {
    position: 'absolute',
    top: (HIT_HEIGHT - THUMB) / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.green,
    borderWidth: 2,
    borderColor: colors.bgElevated,
  },
});
