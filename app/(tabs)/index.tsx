import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ActivityRow } from '@/components/ActivityRow';
import { ServiceIntervalChart } from '@/components/charts/ServiceIntervalChart';
import { TrendSparkline } from '@/components/charts/TrendSparkline';
import { VehicleSwitcher } from '@/components/VehicleSwitcher';
import { ActionButton } from '@/components/ui/ActionButton';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Text } from '@/components/ui/Text';
import { useVehicleStats } from '@/hooks/useVehicleStats';
import { useSheets } from '@/sheets/SheetsProvider';
import { useAppStore } from '@/store/appStore';
import { colors, spacing } from '@/theme/theme';
import { fmtKm, fmtLitres, fmtMileage } from '@/utils/format';
import { buildTimeline } from '@/utils/timeline';

export default function DashboardScreen() {
  const router = useRouter();
  const sheets = useSheets();
  const stats = useVehicleStats();
  const fuelEntries = useAppStore((s) => s.fuelEntries);
  const checkins = useAppStore((s) => s.checkins);
  const services = useAppStore((s) => s.services);

  const recent = buildTimeline(fuelEntries, checkins, services).slice(0, 3);
  const lifetime = stats.lifetime.kmPerLitre;
  const sinceSvc = stats.sinceService.kmPerLitre;
  const fuel = stats.fuel;

  return (
    <Screen bottomInset={spacing.xl}>
      <VehicleSwitcher />

      <Card style={styles.mileageCard}>
        <Text variant="tiny" color={colors.textMuted}>
          MILEAGE
        </Text>
        <View style={styles.mileageRow}>
          <Text style={styles.mileageValue}>{fmtMileage(lifetime)}</Text>
          <Text variant="h3" color={colors.textSecondary} style={styles.mileageUnit}>
            km/l
          </Text>
        </View>
        <Text variant="small" color={colors.textSecondary}>
          {sinceSvc != null && services.length > 0
            ? `Since last service ${fmtMileage(sinceSvc)} km/l`
            : lifetime != null
              ? 'Lifetime average across all fill-ups'
              : 'Add two fuel fills to see your mileage'}
        </Text>
      </Card>

      <View style={styles.statRow}>
        <StatCard
          label="Fuel left"
          value={fuel?.canEstimate ? fmtLitres(fuel.remainingLitres, 1) : '—'}
          unit="L"
          valueColor={
            fuel?.canEstimate && fuel.atOrBelowReserve ? colors.danger : undefined
          }
        />
        <StatCard
          label="Range"
          value={fuel?.canEstimate ? fmtKm(fuel.estimatedRangeKm) : '—'}
          unit="km"
        />
        <StatCard label="This month" value={fmtKm(stats.driving.kmThisMonth)} unit="km" />
      </View>

      <View style={styles.statRow}>
        <StatCard
          label="Odometer"
          value={fmtKm(stats.lastKnownOdometer)}
          unit="km"
        />
        <StatCard
          label="Fuel filled"
          value={stats.totalLitresFilled > 0 ? fmtLitres(stats.totalLitresFilled, 1) : '—'}
          unit="L"
          hint="Logged to date"
        />
      </View>

      {fuel && !fuel.canEstimate ? (
        <Text variant="small" color={colors.textMuted}>
          {fuel.reason === 'no-full-tank'
            ? 'Add a full-tank fill to enable fuel & range estimates.'
            : fuel.reason === 'no-mileage'
              ? 'Log more fills so mileage can be estimated for range.'
              : 'Log an odometer reading to enable range estimates.'}
        </Text>
      ) : null}

      <View style={styles.actionsRow}>
        <ActionButton label="Add fuel" icon="gas-station" tone="green" onPress={sheets.addFuel} />
        <ActionButton
          label="Log odometer"
          icon="speedometer"
          tone="blue"
          onPress={sheets.logOdometer}
        />
      </View>
      <ActionButton
        label="Log service"
        icon="wrench"
        tone="orange"
        compact
        onPress={sheets.logService}
      />

      <Card>
        <SectionHeader title="Mileage by service interval" />
        <Text variant="small" color={colors.textMuted} style={styles.subLabel}>
          km/l
        </Text>
        <ServiceIntervalChart buckets={stats.buckets} />
      </Card>

      <Card>
        <SectionHeader title="Mileage trend" />
        <TrendSparkline points={stats.trend} />
      </Card>

      <Card>
        <SectionHeader
          title="Recent activity"
          trailing={
            <Text variant="small" color={colors.green} onPress={() => router.push('/history')}>
              All
            </Text>
          }
        />
        {recent.length === 0 ? (
          <Text variant="small" color={colors.textMuted}>
            Nothing logged yet. Tap “Add fuel” or “Log odometer” to start.
          </Text>
        ) : (
          recent.map((item, i) => (
            <View key={`${item.kind}-${item.data.id}`}>
              {i > 0 ? <View style={styles.divider} /> : null}
              <ActivityRow item={item} />
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  mileageCard: { alignItems: 'flex-start', gap: spacing.xs },
  mileageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  mileageValue: {
    color: colors.textPrimary,
    fontSize: 52,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 56,
  },
  mileageUnit: { marginBottom: 8 },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  actionsRow: { flexDirection: 'row', gap: spacing.md },
  subLabel: { marginTop: -spacing.xs, marginBottom: spacing.sm },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});
