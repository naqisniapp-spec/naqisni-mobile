/**
 * Keeps Naqisni's remote controls (maintenance, minimum version, banner,
 * feature switches) up to date: read at start, after signing in or out, and
 * whenever the app comes back to the front.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { cachedConfig, DEFAULT_CONFIG, featureOn, fetchConfig, recordOpen, type Feature, type RemoteConfig } from '@/lib/remote-config';
import { useApp } from '@/providers/app-provider';

type State = { config: RemoteConfig; loaded: boolean; refresh: () => void };

const Ctx = createContext<State>({ config: DEFAULT_CONFIG, loaded: false, refresh: () => undefined });

/** Not more often than this when the app keeps coming back to the front. */
const MIN_GAP_MS = 30_000;

export function RemoteConfigProvider({ children }: { children: ReactNode }) {
  const { session, lang } = useApp();
  const userId = session?.user.id ?? null;
  const [config, setConfig] = useState<RemoteConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);
  const last = useRef(0);
  const langRef = useRef(lang);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  const refresh = useCallback(() => {
    last.current = Date.now();
    fetchConfig().then((cfg) => {
      if (cfg) setConfig(cfg);
      setLoaded(true);
    });
    recordOpen(langRef.current);
  }, []);

  // What the phone knew last time, straight away.
  useEffect(() => {
    cachedConfig().then((cfg) => setConfig((cur) => (cur === DEFAULT_CONFIG ? cfg : cur)));
  }, []);

  // At start and when the signed-in person changes (features can differ per business).
  useEffect(() => {
    refresh();
  }, [userId, refresh]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && Date.now() - last.current > MIN_GAP_MS) refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return <Ctx.Provider value={{ config, loaded, refresh }}>{children}</Ctx.Provider>;
}

export function useRemoteConfig() {
  return useContext(Ctx);
}

/** False when Naqisni switched this feature off (for everyone or for this business). */
export function useFeature(f: Feature): boolean {
  return featureOn(useContext(Ctx).config, f);
}
