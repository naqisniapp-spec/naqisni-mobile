/**
 * Phone notifications for low-stock alerts.
 *
 * The phone's Expo push token is saved in push_tokens (naqisni-web migration
 * 0064); naqisni.com sends new alerts to it (src/lib/predict/push.ts).
 * Needs a development or store build: Expo Go on Android can't receive push
 * notifications. Also needs the EAS project id (run `npx eas-cli@latest init`).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import type { Lang } from '@/lib/i18n';
import { installId } from '@/lib/remote-config';
import { supabase } from '@/lib/supabase';

const K_TOKEN = 'naqisni_push_token';

// Show alerts as a banner even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type PushProblem = 'simulator' | 'denied' | 'no_project' | 'expo_go' | 'failed';

function projectId(): string | undefined {
  return (
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    undefined
  );
}

export async function savedPushToken() {
  return AsyncStorage.getItem(K_TOKEN);
}

/** Asks for permission (if needed) and saves this phone for the business. */
export async function enablePush(businessId: string, userId: string, lang: Lang): Promise<{ ok: true } | { ok: false; problem: PushProblem }> {
  if (!Device.isDevice) return { ok: false, problem: 'simulator' };
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient && Platform.OS === 'android') return { ok: false, problem: 'expo_go' };
  const id = projectId();
  if (!id) return { ok: false, problem: 'no_project' };

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('alerts', {
      name: lang === 'ar' ? 'تنبيهات المخزون' : 'Stock alerts',
      importance: AndroidImportance.HIGH,
      lightColor: '#8CC63F',
      vibrationPattern: [0, 250, 150, 250],
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return { ok: false, problem: 'denied' };

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    const { error } = await supabase.from('push_tokens').upsert(
      {
        token,
        user_id: userId,
        business_id: businessId,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        lang,
        install_id: await installId(),
        last_seen_at: new Date().toISOString(),
        disabled_at: null,
      },
      { onConflict: 'token' }
    );
    if (error) throw new Error(error.message);
    await AsyncStorage.setItem(K_TOKEN, token);
    return { ok: true };
  } catch (e) {
    console.warn('Saving the push token failed', e);
    return { ok: false, problem: 'failed' };
  }
}

/** Stops notifications on this phone (also used on sign-out). */
export async function disablePush() {
  const token = await AsyncStorage.getItem(K_TOKEN);
  if (!token) return;
  await supabase.from('push_tokens').delete().eq('token', token);
  await AsyncStorage.removeItem(K_TOKEN);
}

/** Keeps the saved row fresh (language, last seen) while notifications are on. */
export async function refreshPush(businessId: string, userId: string, lang: Lang) {
  if (!(await AsyncStorage.getItem(K_TOKEN))) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  await enablePush(businessId, userId, lang);
}
