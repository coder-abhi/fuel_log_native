import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ServiceIntervalChart } from '@/components/charts/ServiceIntervalChart';
import { TrendSparkline } from '@/components/charts/TrendSparkline';
import { WeekdayBars } from '@/components/charts/WeekdayBars';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Segmented } from '@/components/ui/Segmented';
import { StatCard } from '@/components/ui/StatCard';
import { Text } from '@/components/ui/Text';
import { useVehicleStats } from '@/hooks/useVehicleStats';
import { colors, spacing } from '@/theme/theme';
import { fmtKm, fmtMileage } from '@/utils/format';

type Tab = 'overview' | 'trends' | 'pattern';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'trends', label: 'Trends' },
  { key: 'pattern', label: 'Driving pattern' },
];

export default function StatsScreen() {
  const [tab, setTab] = useState<Tab>('overview');
  const stats = useVehicleStats();
  const d = stats.driving;

  const dayOfMonth = new Date().getDate();
  const dailyAvg = d.kmThisMonth > 0 ? d.kmThisMonth / dayOfMonth : 0;

  return (
    <Screen bottomInset={spacing.xl}>
      <Text variant="h1">Stats</Text>
      <Segmented options={TABS} value={tab} onChange={setTab} />

      {tab === 'overview' ? (
        <>
          <View style={styles.row}>
            <StatCard label="This month" value={fmtKm(d.kmThisMonth)} unit="km" />
            <StatCard label="Daily avg" value={fmtKm(dailyAvg, 1)} unit="km" />
          </View>
          <View style={styles.row}>
            <StatCard
              label="This week"
              value={fmtKm(d.kmThisWeek)}
              unit="km"
            />
            <StatCard
              label="Lifetime mileage"
              value={fmtMileage(stats.lifetime.kmPerLitre)}
              unit="km/l"
            />
          </View>
          <Card>
            <SectionHeader title="Weekday vs weekend" />
            <View style={styles.row}>
              <StatCard
                label="Weekday avg"
                value={d.weekdayAvgKm != null ? fmtKm(d.weekdayAvgKm, 1) : '—'}
                unit="km/day"
                hint="Mon–Fri"
              />
              <StatCard
                label="Weekend avg"
                value={d.weekendAvgKm != null ? fmtKm(d.weekendAvgKm, 1) : '—'}
                unit="km/day"
                hint="Sat–Sun"
              />
            </View>
          </Card>
        </>
      ) : null}

      {tab === 'trends' ? (
        <>
          <Card>
            <SectionHeader title="Mileage trend" />
            <Text variant="small" color={colors.textMuted} style={styles.sub}>
              Running average km/l after each fill
            </Text>
            <TrendSparkline points={stats.trend} height={120} />
          </Card>
          <Card>
            <SectionHeader title="Mileage by service interval" />
            <ServiceIntervalChart buckets={stats.buckets} />
          </Card>
        </>
      ) : null}

      {tab === 'pattern' ? (
        <>
          <View style={styles.row}>
            <StatCard
              label="Weekday avg"
              value={d.weekdayAvgKm != null ? fmtKm(d.weekdayAvgKm, 1) : '—'}
              unit="km/day"
              hint="Mon–Fri"
            />
            <StatCard
              label="Weekend avg"
              value={d.weekendAvgKm != null ? fmtKm(d.weekendAvgKm, 1) : '—'}
              unit="km/day"
              hint="Sat–Sun"
            />
          </View>
          <Card>
            <SectionHeader title="Km by day of week" />
            <Text variant="small" color={colors.textMuted} style={styles.sub}>
              This month
            </Text>
            <WeekdayBars kmByWeekday={d.kmByWeekday} />
          </Card>
        </>
      ) : null}

      {!stats.hasData ? (
        <Text variant="small" color={colors.textMuted}>
          Log a few odometer readings and fills to populate your stats.
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  sub: { marginTop: -spacing.xs, marginBottom: spacing.sm },
});
