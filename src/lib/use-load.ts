import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

type State<T> = { key: string | null; data: T | null; error: string | null };

/**
 * Loads data for a screen, reloads when `key` changes (e.g. another store is
 * picked) and quietly refreshes whenever the screen comes back into view.
 */
export function useLoad<T>(load: () => Promise<T>, key: string) {
  const [state, setState] = useState<State<T>>({ key: null, data: null, error: null });
  const [refreshing, setRefreshing] = useState(false);
  const loadRef = useRef(load);
  const keyRef = useRef(key);
  const focusedOnce = useRef(false);

  useEffect(() => {
    loadRef.current = load;
    keyRef.current = key;
  });

  const run = useCallback(async () => {
    const forKey = keyRef.current;
    try {
      const data = await loadRef.current();
      if (keyRef.current === forKey) setState({ key: forKey, data, error: null });
    } catch (e) {
      if (keyRef.current === forKey) setState((s) => ({ key: forKey, data: s.data, error: e instanceof Error ? e.message : String(e) }));
    }
  }, []);

  useEffect(() => {
    run();
  }, [key, run]);

  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        return;
      }
      run();
    }, [run])
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await run();
    setRefreshing(false);
  }, [run]);

  const loading = state.key !== key;
  return { data: loading ? null : state.data, error: loading ? null : state.error, loading, refreshing, refresh, reload: run };
}
