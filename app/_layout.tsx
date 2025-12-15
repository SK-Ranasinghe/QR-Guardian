import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import 'react-native-reanimated';

import { useBiometricLock } from '@/hooks/use-biometric-lock';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { isChecking, isAuthenticated } = useBiometricLock();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {isChecking ? null : isAuthenticated ? (
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="result" options={{ title: 'Scan Result' }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
      ) : (
        <View
          style={{
            flex: 1,
            backgroundColor: '#050816',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: '#f9fafb',
              fontSize: 24,
              fontWeight: '700',
              marginBottom: 8,
            }}
          >
            QRGuardian Locked
          </Text>
          <Text
            style={{
              color: '#9ca3af',
              fontSize: 14,
              textAlign: 'center',
              paddingHorizontal: 32,
            }}
          >
            Unlock with Face ID / Touch ID or your device security to continue.
          </Text>
        </View>
      )}
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
