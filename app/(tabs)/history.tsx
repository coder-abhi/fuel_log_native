import { useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActivityRow } from '@/components/ActivityRow';
import { AddMenuFab } from '@/components/AddMenuFab';
import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { useSheets } from '@/sheets/SheetsProvider';
import { useAppStore } from '@/store/appStore';
import { colors, spacing } from '@/theme/theme';
import { fmtMonthHeader, monthKey } from '@/utils/format';
import {
  buildTimeline,
  filterTimeline,
  type TimelineFilter,
  type TimelineItem,
} from '@/utils/timeline';

const FILTERS: { key: TimelineFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'fuel', label: 'Fuel' },
  { key: 'odometer', label: 'Odometer' },
  { key: 'service', label: 'Service' },
];

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const sheets = useSheets();
  const fuelEntries = useAppStore((s) => s.fuelEntries);
  const checkins = useAppStore((s) => s.checkins);
  const services = useAppStore((s) => s.services);
  const [filter, setFilter] = useState<TimelineFilter>('all');

  const sections = useMemo(() => {
    const items = filterTimeline(buildTimeline(fuelEntries, checkins, services), filter);
    const map = new Map<string, TimelineItem[]>();
    for (const it of items) {
      const k = monthKey(it.at);
      const arr = map.get(k);
      if (arr) arr.push(it);
      else map.set(k, [it]);
    }
    return Array.from(map.entries()).map(([k, data]) => ({
      key: k,
      title: fmtMonthHeader(data[0].at),
      data,
    }));
  }, [fuelEntries, checkins, services, filter]);

  const onEdit = (item: TimelineItem) => {
    if (item.kind === 'fuel') sheets.editFuel(item.data);
    else if (item.kind === 'odometer') sheets.editOdometer(item.data);
    else sheets.editService(item.data);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      <Text variant="h1" style={styles.title}>
        History
      </Text>

      <View style={styles.chips}>
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            active={filter === f.key}
            onPress={() => setFilter(f.key)}
          />
        ))}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => `${item.kind}-${item.data.id}`}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 96 }]}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text variant="small" color={colors.textMuted} style={styles.empty}>
            No entries yet.
          </Text>
        }
        renderSectionHeader={({ section }) => (
          <Text variant="tiny" color={colors.textMuted} style={styles.sectionHeader}>
            {section.title.toUpperCase()}
          </Text>
        )}
        renderItem={({ item }) => (
          <ActivityRow item={item} showEdit onEdit={() => onEdit(item)} />
        )}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
      />

      <AddMenuFab />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg },
  title: { marginBottom: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  list: { gap: 0, paddingTop: spacing.sm },
  sectionHeader: { marginTop: spacing.lg, marginBottom: spacing.xs },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  empty: { marginTop: spacing.xxl, textAlign: 'center' },
});
