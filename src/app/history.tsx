import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { BusinessGate } from '@/components/business-gate';
import { ClockCounterClockwise, MagnifyingGlass } from '@/components/icons';
import { Empty, ErrorState, Loading, panel, Text } from '@/components/ui';
import type { Business } from '@/lib/data';
import { sourceName } from '@/lib/products';
import { qty } from '@/lib/stock';
import { loadHistory, MOVE_TYPES, type HistoryMove, type MoveType } from '@/lib/stock-tools';
import { radius, space } from '@/lib/theme';
import { useApp } from '@/providers/app-provider';
import { gated } from '@/components/app-gate';

const PERIODS = [7, 30, 90, null] as const;

/** Every stock change in the store being worked in: what, how many and when. */
function HistoryScreen() {
  const { t } = useApp();
  return (
    <>
      <Stack.Screen options={{ title: t.stockHistory }} />
      <BusinessGate>{(b) => <History business={b} />}</BusinessGate>
    </>
  );
}

function History({ business }: { business: Business }) {
  const { c, t, lang, scopeKey, allStores } = useApp();
  const [type, setType] = useState<MoveType | null>(null);
  const [days, setDays] = useState<number | null>(30);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const key = `${scopeKey}|${type}|${days}|${search}`;
  /** The rows loaded for `key` (a new filter starts again from page 0). */
  const [result, setResult] = useState<{ key: string; moves: HistoryMove[]; page: number; more: boolean; error: string | null } | null>(null);
  const [busy, setBusy] = useState<'more' | 'refreshing' | null>(null);
  const keyRef = useRef(key);

  useEffect(() => {
    keyRef.current = key;
  });

  // Search after a short pause in typing.
  useEffect(() => {
    const id = setTimeout(() => setSearch(query), 350);
    return () => clearTimeout(id);
  }, [query]);

  const fetchPage = useCallback(
    async (forKey: string, page: number, before: HistoryMove[]) => {
      try {
        const res = await loadHistory(business.id, { type, days, query: search, page });
        if (keyRef.current === forKey) setResult({ key: forKey, moves: [...before, ...res.moves], page, more: res.more, error: null });
      } catch (e) {
        if (keyRef.current === forKey) setResult({ key: forKey, moves: before, page: Math.max(0, page - 1), more: false, error: e instanceof Error ? e.message : String(e) });
      }
    },
    [business.id, type, days, search]
  );

  // Called through a ref, like useLoad, so a new filter loads once.
  const fetchRef = useRef(fetchPage);
  useEffect(() => {
    fetchRef.current = fetchPage;
  });
  useEffect(() => {
    fetchRef.current(key, 0, []);
  }, [key]);

  const loading = result?.key !== key;
  const moves = loading ? [] : result.moves;
  const error = loading ? null : result.error;

  async function loadMore() {
    if (loading || busy || !result.more) return;
    setBusy('more');
    await fetchPage(key, result.page + 1, result.moves);
    setBusy(null);
  }

  async function refresh() {
    setBusy('refreshing');
    await fetchPage(key, 0, []);
    setBusy(null);
  }

  const label: Record<string, string> = {
    sale: t.sale,
    restock: t.restock,
    return: t.return,
    adjustment: t.adjustment,
    transfer: t.transfer,
    waste: t.waste,
  };
  const when = (iso: string) =>
    new Date(iso).toLocaleString(lang === 'ar' ? 'ar' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const header = (
    <View style={{ gap: space.md, paddingTop: space.md, paddingBottom: space.md }}>
      <View style={[styles.searchWrap, { backgroundColor: c.card, borderColor: c.hairline }]}>
        <MagnifyingGlass size={18} color={c.slate} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t.searchProduct}
          placeholderTextColor={c.slate}
          autoCorrect={false}
          clearButtonMode="while-editing"
          style={[styles.search, { color: c.ink }]}
        />
      </View>
      <Pills
        options={[{ key: 'all', label: t.allTypes, on: type === null, press: () => setType(null) }].concat(
          MOVE_TYPES.map((m) => ({ key: m, label: label[m], on: type === m, press: () => setType(m) }))
        )}
      />
      <Pills
        options={PERIODS.map((d) => ({
          key: String(d),
          label: d === null ? t.allTime : t.lastDays(d),
          on: days === d,
          press: () => setDays(d),
        }))}
      />
      {error ? <Text tone="alert">{error}</Text> : null}
      {allStores ? (
        <Text tone="slate" size={13}>
          {t.historyAllStores}
        </Text>
      ) : null}
    </View>
  );

  if (!result) return <Loading />;
  if (error && !moves.length) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <FlatList
      data={moves}
      keyExtractor={(m) => m.id}
      contentContainerStyle={[panel(c), { marginBottom: space.xxl * 2 }]}
      keyboardDismissMode="on-drag"
      ListHeaderComponent={header}
      refreshControl={<RefreshControl refreshing={busy === 'refreshing'} onRefresh={refresh} tintColor={c.brandDeep} />}
      onEndReachedThreshold={0.4}
      onEndReached={loadMore}
      ListFooterComponent={busy === 'more' || loading ? <ActivityIndicator color={c.brandDeep} style={{ margin: space.lg }} /> : undefined}
      ListEmptyComponent={
        loading ? undefined : <Empty text={t.noHistory} icon={<ClockCounterClockwise size={40} color={c.slate} weight="duotone" />} />
      }
      renderItem={({ item: m, index }) => {
        const unit = m.products?.unit ? ` ${m.products.unit}` : '';
        const from = m.source && m.source !== 'manual' ? sourceName(m.source) : null;
        const extra = [m.type === 'waste' && m.reason ? t.wasteReasons[m.reason as keyof typeof t.wasteReasons] : null, from, m.note]
          .filter(Boolean)
          .join(' · ');
        return (
          <Pressable
            onPress={() => router.push({ pathname: '/product/[id]', params: { id: m.product_id } })}
            style={({ pressed }) => [
              styles.row,
              index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline },
              pressed && { opacity: 0.6 },
            ]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text weight="600" numberOfLines={1}>
                {m.products?.name ?? '—'}
              </Text>
              <Text tone="slate" size={12} numberOfLines={2}>
                {label[m.type] ?? m.type} · {when(m.occurred_at)}
                {extra ? ` · ${extra}` : ''}
              </Text>
            </View>
            <Text weight="700" style={{ color: m.quantity < 0 ? c.alert : c.brandDeep }}>
              {m.quantity > 0 ? '+' : ''}
              {qty(m.quantity)}
              {unit}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

function Pills({ options }: { options: { key: string; label: string; on: boolean; press: () => void }[] }) {
  const { c } = useApp();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
      {options.map((o) => (
        <Pressable
          key={o.key}
          onPress={o.press}
          accessibilityRole="button"
          accessibilityState={{ selected: o.on }}
          style={[styles.pill, { backgroundColor: o.on ? c.ink : c.card, borderColor: o.on ? c.ink : c.hairline }]}>
          <Text size={13} weight="600" style={{ color: o.on ? c.card : c.ink }}>
            {o.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: space.md },
  search: { flex: 1, minHeight: 46, fontSize: 16 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
});

export default gated('history', HistoryScreen);
