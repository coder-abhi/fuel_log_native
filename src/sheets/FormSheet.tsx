import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { forwardRef, type ReactNode, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme/theme';

interface Props {
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  /** called when the sheet starts opening (from closed) — seed form state here */
  onOpen?: () => void;
  submitLabel?: string;
  submitting?: boolean;
  canSubmit?: boolean;
  destructive?: ReactNode;
  children: ReactNode;
}

export const FormSheet = forwardRef<BottomSheetModal, Props>(function FormSheet(
  {
    title,
    onClose,
    onSubmit,
    onOpen,
    submitLabel = 'Save',
    submitting,
    canSubmit = true,
    destructive,
    children,
  },
  ref,
) {
  const insets = useSafeAreaInsets();

  const renderBackdrop = useCallback(
    (p: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...p} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={['88%']}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.bg}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      enableDynamicSizing={false}
      onAnimate={(from, to) => {
        if (from === -1 && to >= 0) onOpen?.();
      }}
    >
      <View style={styles.header}>
        <Text variant="h2">{title}</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
        </Pressable>
      </View>

      <BottomSheetScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        {children}
        {destructive ? <View style={styles.destructive}>{destructive}</View> : null}
      </BottomSheetScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          label={submitLabel}
          onPress={onSubmit}
          loading={submitting}
          disabled={!canSubmit}
        />
      </View>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  bg: { backgroundColor: colors.bgElevated, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  handle: { backgroundColor: colors.borderStrong, width: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  body: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  destructive: { marginTop: spacing.sm },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
});
