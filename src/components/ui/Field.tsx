import { type ComponentType, type ReactNode } from 'react';
import {
  StyleSheet,
  TextInput as RNTextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { colors, radius, spacing } from '@/theme/theme';
import { Text } from './Text';

export function Field({
  label,
  required,
  hint,
  error,
  children,
  trailing,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text variant="small" color={colors.textSecondary}>
          {label}
          {required ? <Text color={colors.green}> *</Text> : null}
        </Text>
        {trailing}
      </View>
      {children}
      {error ? (
        <Text variant="small" color={colors.danger}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="small" color={colors.textMuted}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

interface TextFieldProps extends TextInputProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  /** allows sheets to inject BottomSheetTextInput */
  inputComponent?: ComponentType<TextInputProps>;
}

export function TextField({
  label,
  required,
  hint,
  error,
  inputComponent,
  style,
  ...inputProps
}: TextFieldProps) {
  const Input = inputComponent ?? RNTextInput;
  return (
    <Field label={label} required={required} hint={hint} error={error}>
      <Input
        placeholderTextColor={colors.textMuted}
        style={[styles.input, !!error && styles.inputError, style]}
        {...inputProps}
      />
    </Field>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  input: {
    backgroundColor: colors.surfaceInput,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: 16,
    minHeight: 48,
  },
  inputError: { borderColor: colors.danger },
});
