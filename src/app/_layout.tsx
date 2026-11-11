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
import { useCallback, useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppGate } from '@/components/app-gate';
import { Intro } from '@/components/intro';
import { Loading } from '@/components/ui';
import { refreshPush } from '@/lib/push';
import { AppProvider, useApp } from '@/providers/app-provider';
import { RemoteConfigProvider } from '@/providers/remote-config-provider';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Navigator({ fontsReady }: { fontsReady: boolean }) {
  const { ready, session, business, lang, c, dark, t } = useApp();

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
          <Stack.Screen name="ask" options={{ title: '' }} />
          <Stack.Screen name="orders" options={{ title: t.tabOrders }} />
          <Stack.Screen name="suppliers" options={{ title: '' }} />
          <Stack.Screen name="supplier/[key]" options={{ title: '' }} />
          <Stack.Screen name="expiry" options={{ title: '' }} />
          <Stack.Screen name="reports" options={{ title: '' }} />
          <Stack.Screen name="alert-settings" options={{ title: '' }} />
          <Stack.Screen name="batch" options={{ presentation: 'formSheet', title: t.addBatch, sheetAllowedDetents: [0.75, 1], sheetGrabberVisible: true }} />
          <Stack.Screen name="history" options={{ title: '' }} />
          <Stack.Screen name="photo" options={{ presentation: 'fullScreenModal', headerShown: false }} />
          <Stack.Screen name="record" options={{ presentation: 'formSheet', title: t.recordChange, sheetAllowedDetents: [0.75, 1], sheetGrabberVisible: true }} />
          <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', headerShown: false }} />
          <Stack.Screen name="inbox/index" options={{ title: t.inbox }} />
          <Stack.Screen name="inbox/[id]" options={{ title: '' }} />
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
    const data = lastTap?.notification.request.content.data;
    const url = data?.url;
    const campaign = data?.campaign;
    // A message from Naqisni (naqisni.com/admin/mobile): open the inbox. It stays
    // unread (and counted on the bell) until it is opened there.
    if (typeof campaign === 'string') {
      router.push('/inbox');
      Notifications.clearLastNotificationResponse();
      return;
    }
    if (typeof url !== 'string') return;
    if (url.startsWith('/product/')) router.push({ pathname: '/product/[id]', params: { id: url.slice('/product/'.length) } });
    else if (url === '/alerts') router.push('/alerts');
    // Notifications sent by Naqisni from naqisni.com/admin/mobile.
    else if (url === '/products') router.push('/products');
    else if (url === '/orders') router.push('/orders');
    else if (url === '/support') router.push('/support');
    else if (url === '/more') router.push('/more');
    else if (url === '/') router.push('/');
    Notifications.clearLastNotificationResponse();
  }, [lastTap]);
  return null;
}

/**
 * The app, with the animated intro (logo + drifting boxes) on top while it loads.
 * The native splash is the same navy, so handing over to the intro is seamless.
 */
function Shell() {
  const { ready } = useApp();
  const [fontsLoaded, fontError] = useFonts({ IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold, IBMPlexSans_700Bold });
  const fontsReady = fontsLoaded || Boolean(fontError);
  const [introDone, setIntroDone] = useState(false);
  const hideNativeSplash = useCallback(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);
  const finishIntro = useCallback(() => setIntroDone(true), []);
  return (
    <View style={{ flex: 1 }}>
      <AppGate>
        <Navigator fontsReady={fontsReady} />
      </AppGate>
      {introDone ? null : <Intro appReady={ready && fontsReady} onShown={hideNativeSplash} onDone={finishIntro} />}
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <RemoteConfigProvider>
          <Shell />
        </RemoteConfigProvider>
      </AppProvider>
    </GestureHandlerRootView>
  );
}
