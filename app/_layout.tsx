import 'react-native-gesture-handler';
import 'react-native-reanimated';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import { SheetsProvider } from '@/sheets/SheetsProvider';
import { useAppStore } from '@/store/appStore';
import { colors } from '@/theme/theme';

export default function RootLayout() {
  const ready = useAppStore((s) => s.ready);
  const bootstrap = useAppStore((s) => s.bootstrap);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {ready ? (
          <BottomSheetModalProvider>
            <SheetsProvider>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.bg },
                  animation: 'slide_from_right',
                }}
              >
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
                <Stack.Screen
                  name="vehicle/[id]"
                  options={{
                    headerShown: true,
                    title: 'Vehicle settings',
                    headerStyle: { backgroundColor: colors.bg },
                    headerTintColor: colors.textPrimary,
                    headerShadowVisible: false,
                  }}
                />
              </Stack>
            </SheetsProvider>
          </BottomSheetModalProvider>
        ) : (
          <Splash />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Splash() {
  return (
    <View style={styles.splash}>
      <Text variant="h1" color={colors.green}>
        MileTrack
      </Text>
      <ActivityIndicator color={colors.textMuted} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: colors.bg,
  },
});
