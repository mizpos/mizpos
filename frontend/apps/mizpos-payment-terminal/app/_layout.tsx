import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { TerminalProvider, PairingProvider } from '@/providers';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <TerminalProvider>
        <PairingProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="reader-setup" options={{ title: 'リーダー設定', presentation: 'modal' }} />
            <Stack.Screen name="pairing" options={{ title: 'ペアリング', presentation: 'modal' }} />
            <Stack.Screen name="payment" options={{ title: '決済', presentation: 'modal' }} />
          </Stack>
          <StatusBar style="auto" />
        </PairingProvider>
      </TerminalProvider>
    </ThemeProvider>
  );
}
