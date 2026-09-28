import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme/theme';
import { fmtDate, fmtDateTime } from '@/utils/format';
import { Field } from './Field';
import { Text } from './Text';

interface Props {
  label: string;
  /** ISO string */
  value: string;
  onChange: (iso: string) => void;
  mode?: 'date' | 'datetime';
  required?: boolean;
}

export function DateTimeField({
  label,
  value,
  onChange,
  mode = 'date',
  required,
}: Props) {
  const current = new Date(value);

  const openTime = (base: Date) => {
    DateTimePickerAndroid.open({
      value: base,
      mode: 'time',
      is24Hour: false,
      onValueChange: (_event, t) => {
        const merged = new Date(base);
        merged.setHours(t.getHours(), t.getMinutes(), 0, 0);
        onChange(merged.toISOString());
      },
    });
  };

  const open = () => {
    DateTimePickerAndroid.open({
      value: current,
      mode: 'date',
      onValueChange: (_event, d) => {
        if (mode === 'date') {
          const merged = new Date(current);
          merged.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
          onChange(merged.toISOString());
        } else {
          const merged = new Date(current);
          merged.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
          openTime(merged);
        }
      },
    });
  };

  return (
    <Field label={label} required={required}>
      <Pressable onPress={open} style={styles.box}>
        <Text variant="body">
          {mode === 'date' ? fmtDate(value) : fmtDateTime(value)}
        </Text>
        <View style={styles.icons}>
          <MaterialCommunityIcons
            name="calendar-blank-outline"
            size={20}
            color={colors.textSecondary}
          />
        </View>
      </Pressable>
    </Field>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceInput,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  icons: { flexDirection: 'row', gap: spacing.sm },
});
