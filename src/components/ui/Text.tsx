import { Text as RNText, StyleSheet, type TextProps } from 'react-native';

import { colors, font } from '@/theme/theme';

type Variant = keyof typeof font;

interface Props extends TextProps {
  variant?: Variant;
  color?: string;
  center?: boolean;
}

export function Text({ variant = 'body', color, center, style, ...rest }: Props) {
  return (
    <RNText
      style={[
        font[variant],
        { color: color ?? colors.textPrimary },
        center && styles.center,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
});
