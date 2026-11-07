/**
 * One Supabase client for the whole app — the same project as naqisni.com,
 * so row-level security decides what each person sees, exactly like the web.
 *
 * Store scope (migration 0039): every request carries x-naqisni-store with the
 * store picked in the app. The stores list itself is read with "all", like
 * the web's Stores overview.
 */
import 'react-native-get-random-values';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as aesjs from 'aes-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;
if (!url || !key) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_KEY in .env');
}

/** The website (Next.js) — server actions such as approving orders go through its API. */
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://naqisni.com').replace(/\/$/, '');

/**
 * The session is larger than the 2 KB SecureStore limit, so it is AES-encrypted
 * into AsyncStorage and only the key lives in the Keychain / Keystore.
 */
class LargeSecureStore {
  private async encrypt(name: string, value: string) {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encrypted = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(name, aesjs.utils.hex.fromBytes(encryptionKey));
    return aesjs.utils.hex.fromBytes(encrypted);
  }

  private async decrypt(name: string, value: string) {
    const hexKey = await SecureStore.getItemAsync(name);
    if (!hexKey) return null;
    const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(hexKey), new aesjs.Counter(1));
    return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(value)));
  }

  async getItem(name: string) {
    const stored = await AsyncStorage.getItem(name);
    return stored ? this.decrypt(name, stored) : null;
  }

  async setItem(name: string, value: string) {
    await AsyncStorage.setItem(name, await this.encrypt(name, value));
  }

  async removeItem(name: string) {
    await AsyncStorage.removeItem(name);
    await SecureStore.deleteItemAsync(name);
  }
}

let storeScope: string | null = null;

/** The store every query works in (null: the person's first store). */
export function setStoreScope(id: string | null) {
  storeScope = id;
}

const scopedFetch: typeof fetch = (input, init = {}) => {
  const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const headers = new Headers(init.headers);
  if (target.includes('/rest/v1/stores')) headers.set('x-naqisni-store', 'all');
  else if (storeScope) headers.set('x-naqisni-store', storeScope);
  return fetch(input, { ...init, headers });
};

export const supabase = createClient(url, key, {
  auth: {
    storage: Platform.OS === 'web' ? AsyncStorage : new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: { fetch: scopedFetch },
});

// Refresh the session only while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Calls a naqisni.com API route as the signed-in person (Bearer token + store). */
export async function webApi<T>(path: string, body?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in');
  const res = await fetch(`${WEB_URL}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(storeScope ? { 'x-naqisni-store': storeScope } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
}
