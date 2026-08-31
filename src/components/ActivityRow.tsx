import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme/theme';
import { fmtCurrency, fmtDate, fmtKm, fmtLitres } from '@/utils/format';
import { fuelKindLabel, type TimelineItem } from '@/utils/timeline';
import { EntryIcon } from './EntryIcon';
import { Text } from './ui/Text';

interface Props {
  item: TimelineItem;
  onEdit?: () => void;
  showEdit?: boolean;
}

function title(item: TimelineItem): string {
  switch (item.kind) {
    case 'fuel': {
      const f = item.data;
      const litres = f.litresFilled != null ? `${fmtLitres(f.litresFilled)} L · ` : '';
      return `Fuel · ${litres}${fuelKindLabel(f)}`;
    }
    case 'odometer':
      return 'Odometer';
    case 'service':
      return item.data.notes ? `Service · ${item.data.notes}` : 'Service';
  }
}

function cost(item: TimelineItem): number | null {
  if (item.kind === 'fuel' || item.kind === 'service') return item.data.cost ?? null;
  return null;
}

export function ActivityRow({ item, onEdit, showEdit }: Props) {
  const c = cost(item);
  const verified = item.kind === 'fuel' && item.data.isFullTank && !item.data.excludedFromMileage;

  return (
    <View style={styles.row}>
      <EntryIcon kind={item.kind} />
      <View style={styles.middle}>
        <View style={styles.titleRow}>
          <Text variant="bodyStrong" numberOfLines={1} style={styles.title}>
            {title(item)}
          </Text>
          {verified ? (
            <MaterialCommunityIcons name="check-decagram" size={15} color={colors.green} />
          ) : null}
        </View>
        <Text variant="small" color={colors.textMuted}>
          {fmtDate(item.at)}
        </Text>
      </View>
      <View style={styles.right}>
        {item.odometerKm != null ? (
          <Text variant="small" color={colors.textSecondary}>
            {fmtKm(item.odometerKm)} km
          </Text>
        ) : null}
        {c != null ? (
          <Text variant="small" color={colors.textMuted}>
            {fmtCurrency(c)}
          </Text>
        ) : null}
      </View>
      {showEdit ? (
        <Pressable onPress={onEdit} hitSlop={10} style={styles.editBtn}>
          <MaterialCommunityIcons name="pencil" size={18} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  middle: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { flexShrink: 1 },
  right: { alignItems: 'flex-end', gap: 2 },
  editBtn: { paddingLeft: spacing.sm, paddingVertical: spacing.xs },
});
