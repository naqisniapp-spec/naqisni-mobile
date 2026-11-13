/**
 * Controls set by Naqisni in naqisni.com/admin/mobile (naqisni-web migration 0068):
 * maintenance mode, minimum version, a message banner and feature switches.
 * Read through mobile_app_config(); the last answer is kept on the phone so
 * the app still knows when it starts without a connection.
 *
 * The app also reports itself (version, over-the-air update, phone model)
 * through record_mobile_open() so the admin can see who uses which version.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

import type { Lang } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

/** Features the admin can switch off (keys match public.mobile_features). */
export type Feature = 'ask_ai' | 'scan' | 'count' | 'history' | 'expiry' | 'orders' | 'suppliers' | 'reports' | 'support';

type Texts = { en: string | null; ar: string | null };

export type RemoteConfig = {
  maintenance: boolean;
  maintenance_message: Texts | null;
  min_version: string | null;
  update_message: Texts | null;
  android_store_url: string | null;
  ios_store_url: string | null;
  banner: { en: string; ar: string | null; tone: 'info' | 'warning'; until: string | null } | null;
  features: Partial<Record<Feature, boolean>>;
};

export const DEFAULT_CONFIG: RemoteConfig = {
  maintenance: false,
  maintenance_message: null,
  min_version: null,
  update_message: null,
  android_store_url: null,
  ios_store_url: null,
  banner: null,
  features: {},
};

export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.naqisni.app';

const K_CONFIG = 'naqisni_remote_config';
const K_INSTALL = 'naqisni_install_id';

export function appVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

/** "2.1" < "2.1.3" < "2.10": numeric, missing parts are 0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((x) => Number.parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => Number.parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function needsUpdate(cfg: RemoteConfig): boolean {
  return Boolean(cfg.min_version) && compareVersions(appVersion(), cfg.min_version!) < 0;
}

/** Text in the phone's language, falling back to English, then to the app's own wording. */
export function pick(texts: Texts | null | undefined, lang: Lang, fallback: string): string {
  return (lang === 'ar' ? texts?.ar?.trim() : null) || texts?.en?.trim() || fallback;
}

export function featureOn(cfg: RemoteConfig, f: Feature): boolean {
  return cfg.features[f] !== false;
}

export async function cachedConfig(): Promise<RemoteConfig> {
  try {
    const raw = await AsyncStorage.getItem(K_CONFIG);
    return raw ? { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as RemoteConfig) } : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

/** The current controls, or null when the server can't be reached (keep what we had). */
export async function fetchConfig(): Promise<RemoteConfig | null> {
  const { data, error } = await supabase.rpc('mobile_app_config');
  if (error || !data || typeof data !== 'object') return null;
  const cfg = { ...DEFAULT_CONFIG, ...(data as RemoteConfig) };
  AsyncStorage.setItem(K_CONFIG, JSON.stringify(cfg)).catch(() => undefined);
  return cfg;
}

function uuid(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** A random id for this app install, made once and kept on the phone. */
export async function installId(): Promise<string> {
  const saved = await AsyncStorage.getItem(K_INSTALL);
  if (saved) return saved;
  const id = uuid();
  await AsyncStorage.setItem(K_INSTALL, id);
  return id;
}

/** Tells naqisni.com this phone opened the app. Best effort. */
export async function recordOpen(lang: Lang) {
  if (Platform.OS === 'web') return;
  try {
    await supabase.rpc('record_mobile_open', {
      p_install_id: await installId(),
      p_platform: Platform.OS,
      p_app_version: appVersion(),
      p_update_id: Updates.isEnabled && !Updates.isEmbeddedLaunch ? Updates.updateId : null,
      p_update_channel: Updates.channel,
      p_runtime_version: Updates.runtimeVersion,
      p_os_version: Device.osVersion,
      p_device_model: Device.modelName,
      p_lang: lang,
    });
  } catch {
    // Not important enough to bother the user.
  }
}
