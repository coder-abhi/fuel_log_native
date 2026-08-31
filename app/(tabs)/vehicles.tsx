import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useAppStore } from '@/store/appStore';
import { colors, radius, spacing } from '@/theme/theme';
import { fmtLitres } from '@/utils/format';

export default function VehiclesScreen() {
  const router = useRouter();
  const vehicles = useAppStore((s) => s.vehicles);
  const selectedId = useAppStore((s) => s.selectedVehicleId);
  const selectVehicle = useAppStore((s) => s.selectVehicle);

  return (
    <Screen bottomInset={spacing.xl}>
      <Text variant="h1">Vehicles</Text>

      {vehicles.map((v) => {
        const active = v.id === selectedId;
        return (
          <Pressable
            key={v.id}
            style={styles.card}
            onPress={() => {
              selectVehicle(v.id);
              router.push(`/vehicle/${v.id}`);
            }}
          >
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons name="car-sports" size={22} color={colors.textSecondary} />
            </View>
            <View style={styles.body}>
              <View style={styles.nameRow}>
                <Text variant="h3">{v.name}</Text>
                {active ? (
                  <View style={styles.badge}>
                    <Text variant="tiny" color={colors.textInverse}>
                      ACTIVE
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text variant="small" color={colors.textMuted}>
                Tank {fmtLitres(v.tankCapacityLitres, 0)} L · Reserve{' '}
                {fmtLitres(v.reserveThresholdLitres, 1)} L
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
          </Pressable>
        );
      })}

      <Button
        label="Add vehicle"
        variant="secondary"
        icon="plus"
        onPress={() => router.push('/vehicle/new')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: {
    backgroundColor: colors.green,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
