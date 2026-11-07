/**
 * App-wide state: the signed-in session, the business, the store being worked
 * in, language and appearance. Preferences are kept on the device.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { reloadAppAsync } from 'expo';
import { getLocales } from 'expo-localization';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, I18nManager, useColorScheme } from 'react-native';

import { loadBusiness, loadStores, type Business, type Store } from '@/lib/data';
import { strings, type Lang, type Strings } from '@/lib/i18n';
import { setStoreScope, supabase } from '@/lib/supabase';
import { palette, type Colors } from '@/lib/theme';

type ThemePref = 'system' | 'light' | 'dark';

type AppState = {
  ready: boolean;
  session: Session | null;
  business: Business | null;
  businessError: string | null;
  stores: Store[];
  store: Store | null;
  setStore: (id: string) => void;
  /** Bumps whenever the store changes, so screens reload their data. */
  scopeKey: string;
  reloadBusiness: () => Promise<void>;
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Strings;
  rtl: boolean;
  themePref: ThemePref;
  setThemePref: (p: ThemePref) => void;
  dark: boolean;
  c: Colors;
};

const Ctx = createContext<AppState | null>(null);

const K_LANG = 'naqisni_lang';
const K_THEME = 'naqisni_theme';
const K_STORE = 'naqisni_store';

function deviceLang(): Lang {
  return getLocales()[0]?.languageCode === 'ar' ? 'ar' : 'en';
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [prefsReady, setPrefsReady] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [businessError, setBusinessError] = useState<string | null>(null);
  /** The user the business was last loaded for. */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [lang, setLangState] = useState<Lang>(deviceLang());
  const [themePref, setThemePrefState] = useState<ThemePref>('system');
  const scheme = useColorScheme();

  // Saved preferences.
  useEffect(() => {
    (async () => {
      const [l, th, st] = await Promise.all([AsyncStorage.getItem(K_LANG), AsyncStorage.getItem(K_THEME), AsyncStorage.getItem(K_STORE)]);
      if (l === 'en' || l === 'ar') setLangState(l);
      if (th === 'light' || th === 'dark' || th === 'system') setThemePrefState(th);
      if (st) {
        setStoreScope(st);
        setStoreId(st);
      }
      setPrefsReady(true);
    })();
  }, []);

  // Keep the layout direction in step with the language (takes effect after a restart).
  useEffect(() => {
    if (!prefsReady) return;
    I18nManager.allowRTL(true);
    if (I18nManager.isRTL !== (lang === 'ar')) I18nManager.forceRTL(lang === 'ar');
  }, [lang, prefsReady]);

  // Session.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const reloadBusiness = useCallback(async () => {
    if (!userId) return;
    try {
      const [b, s] = await Promise.all([loadBusiness(userId), loadStores()]);
      setBusinessError(null);
      setBusiness(b);
      setStores(s);
      // A saved store this person can no longer use falls back to their first store.
      setStoreId((cur) => {
        const next = s.find((x) => x.id === cur)?.id ?? s[0]?.id ?? null;
        setStoreScope(next);
        return next;
      });
    } catch (e) {
      setBusinessError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadedFor(userId);
    }
  }, [userId]);

  useEffect(() => {
    if (!authReady || !prefsReady || !userId) return;
    // Fetches from Supabase; state is only set after the request returns.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reloadBusiness();
  }, [authReady, prefsReady, userId, reloadBusiness]);

  const setStore = useCallback((id: string) => {
    setStoreScope(id);
    setStoreId(id);
    AsyncStorage.setItem(K_STORE, id);
  }, []);

  const setLang = useCallback(
    (l: Lang) => {
      if (l === lang) return;
      AsyncStorage.setItem(K_LANG, l);
      setLangState(l);
      const needsFlip = I18nManager.isRTL !== (l === 'ar');
      if (needsFlip) {
        I18nManager.allowRTL(true);
        I18nManager.forceRTL(l === 'ar');
        Alert.alert('', strings[l].restartForLanguage, [
          { text: 'OK', onPress: () => reloadAppAsync().catch(() => undefined) },
        ]);
      }
    },
    [lang]
  );

  const setThemePref = useCallback((p: ThemePref) => {
    AsyncStorage.setItem(K_THEME, p);
    setThemePrefState(p);
  }, []);

  const dark = themePref === 'dark' || (themePref === 'system' && scheme === 'dark');
  const store = stores.find((s) => s.id === storeId) ?? null;

  const value = useMemo<AppState>(
    () => ({
      // Signed out: nothing to load. Signed in: wait until this person's business is loaded.
      ready: prefsReady && authReady && (!userId || loadedFor === userId),
      session,
      business,
      businessError,
      stores,
      store,
      setStore,
      scopeKey: `${business?.id ?? ''}:${storeId ?? ''}`,
      reloadBusiness,
      lang,
      setLang,
      t: strings[lang],
      rtl: lang === 'ar',
      themePref,
      setThemePref,
      dark,
      c: dark ? palette.dark : palette.light,
    }),
    [prefsReady, authReady, loadedFor, userId, session, business, businessError, stores, store, setStore, storeId, reloadBusiness, lang, setLang, themePref, setThemePref, dark]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}
