import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
  useFonts,
} from '@expo-google-fonts/ibm-plex-sans';
import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Loading } from '@/components/ui';
import { refreshPush } from '@/lib/push';
import { AppProvider, useApp } from '@/providers/app-provider';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Navigator() {
  const { ready, session, business, lang, c, dark, t } = useApp();
  const [fontsLoaded, fontError] = useFonts({ IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold, IBMPlexSans_700Bold });
  const fontsReady = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    if (ready && fontsReady) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready, fontsReady]);

  // Keep this phone's notification settings (language) up to date.
  useEffect(() => {
    if (ready && session && business) refreshPush(business.id, session.user.id, lang).catch(() => undefined);
  }, [ready, session, business, lang]);


  if (!ready || !fontsReady) return <Loading />;

  const base = dark ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: { ...base.colors, primary: c.brandDeep, background: c.bg, card: c.card, text: c.ink, border: c.hairline },
  };

  return (
    <ThemeProvider value={theme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {Platform.OS !== 'web' && session ? <NotificationTaps /> : null}
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.bg },
          headerTintColor: c.ink,
          headerTitleStyle: lang === 'ar' ? undefined : { fontFamily: 'IBMPlexSans_600SemiBold' },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: c.bg },
        }}>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="product/[id]" options={{ title: '' }} />
          <Stack.Screen name="order/[id]" options={{ title: '' }} />
          <Stack.Screen name="product-form" options={{ title: '' }} />
          <Stack.Screen name="count" options={{ title: '' }} />
          <Stack.Screen name="new-order" options={{ title: '' }} />
          <Stack.Screen name="history" options={{ title: '' }} />
          <Stack.Screen name="photo" options={{ presentation: 'fullScreenModal', headerShown: false }} />
          <Stack.Screen name="record" options={{ presentation: 'formSheet', title: t.recordChange, sheetAllowedDetents: [0.75, 1], sheetGrabberVisible: true }} />
          <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', headerShown: false }} />
          <Stack.Screen name="support/index" options={{ title: t.support }} />
          <Stack.Screen name="support/[id]" options={{ title: '' }} />
          <Stack.Screen name="support/new" options={{ presentation: 'formSheet', title: t.newTicket, sheetAllowedDetents: [0.7, 1], sheetGrabberVisible: true }} />
          <Stack.Screen name="delete-account" options={{ title: t.deleteAccount }} />
          <Stack.Screen name="stores" options={{ presentation: 'formSheet', title: t.chooseStore, sheetAllowedDetents: [0.5, 1], sheetGrabberVisible: true }} />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

/** Tapping an alert notification opens that product (or the Alerts tab). Phones only. */
function NotificationTaps() {
  const lastTap = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const url = lastTap?.notification.request.content.data?.url;
    if (typeof url !== 'string') return;
    if (url.startsWith('/product/')) router.push({ pathname: '/product/[id]', params: { id: url.slice('/product/'.length) } });
    else if (url === '/alerts') router.push('/alerts');
    Notifications.clearLastNotificationResponse();
  }, [lastTap]);
  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <Navigator />
      </AppProvider>
    </GestureHandlerRootView>
  );
}
