import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { BusinessGate } from '@/components/business-gate';
import { Barcode, ClipboardText, MagnifyingGlass } from '@/components/icons';
import { Button, Centered, Empty, ErrorState, Loading, Text } from '@/components/ui';
import type { Business } from '@/lib/data';
import { waitFor } from '@/lib/picker';
import { qty } from '@/lib/stock';
import { loadCountDraft, loadCountProducts, saveCountDraft, saveStockCount, type CountProduct } from '@/lib/stock-tools';
import { radius, space } from '@/lib/theme';
import { useLoad } from '@/lib/use-load';
import { useApp } from '@/providers/app-provider';

type Filter = 'all' | 'todo' | 'diff';

const num = (v: string | undefined) => {
  if (v === undefined || v.trim() === '') return null;
  const n = Number(v.trim().replace(',', '.'));
  return Number.isNaN(n) || n < 0 ? null : n;
};

/**
 * Count what is really on the shelf in the store being worked in. The
 * difference with Naqisni's stock shows as you type; saving corrects the stock
 * (the same save_stock_count as naqisni.com). The count is kept on the phone
 * until it is saved.
 */
export default function CountScreen() {
  const { t, allStores, stores } = useApp();
  return (
    <>
      <Stack.Screen options={{ title: t.countStock }} />
      {allStores && stores.length > 1 ? (
        <Centered>
          <Text style={{ textAlign: 'center', marginBottom: space.lg }}>{t.countPickStore}</Text>
          <Button title={t.chooseStore} onPress={() => router.push('/stores')} />
        </Centered>
      ) : (
        <BusinessGate>{(b) => <Count business={b} />}</BusinessGate>
      )}
    </>
  );
}

function Count({ business }: { business: Business }) {
  const { c, t, store, stores, scopeKey } = useApp();
  const storeId = store?.id ?? 'main';
  const { data, error, loading, refresh } = useLoad(() => loadCountProducts(business.id), scopeKey);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [draftFor, setDraftFor] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'brand' | 'alert'; text: string } | null>(null);

  // The count in progress for this store.
  useEffect(() => {
    let live = true;
    loadCountDraft(business.id, storeId).then((d) => {
      if (!live) return;
      setDraft(d);
      setDraftFor(storeId);
    });
    return () => {
      live = false;
    };
  }, [business.id, storeId]);

  function setCount(id: string, value: string) {
    setMessage(null);
    setDraft((d) => {
      const next = { ...d };
      if (value.trim() === '') delete next[id];
      else next[id] = value;
      saveCountDraft(business.id, storeId, next);
      return next;
    });
  }

  const products = useMemo(() => data ?? [], [data]);
  const entered = products.filter((p) => num(draft[p.product_id]) !== null);
  const different = entered.filter((p) => num(draft[p.product_id]) !== p.current_stock);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const n = num(draft[p.product_id]);
      if (filter === 'todo' && n !== null) return false;
      if (filter === 'diff' && (n === null || n === p.current_stock)) return false;
      return !q || p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q) || (p.barcode ?? '') === q;
    });
  }, [products, draft, query, filter]);

  function scan() {
    waitFor('barcode', (code) => {
      setFilter('all');
      setQuery(code);
    });
    router.push({ pathname: '/scan', params: { pick: '1' } });
  }

  function save() {
    if (!entered.length) return;
    Alert.alert(t.saveCountTitle, t.saveCountBody(entered.length, different.length), [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.save,
        onPress: async () => {
          setBusy(true);
          setMessage(null);
          try {
            await saveStockCount(entered.map((p) => ({ product_id: p.product_id, counted: num(draft[p.product_id])! })));
            setMessage({ tone: 'brand', text: t.countSaved(entered.length, different.length) });
            setDraft({});
            await saveCountDraft(business.id, storeId, {});
            setQuery('');
            setFilter('all');
            await refresh();
          } catch (e) {
            setMessage({ tone: 'alert', text: e instanceof Error ? e.message : t.error });
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  if (loading || draftFor !== storeId) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;
  if (!products.length)
    return (
      <Centered>
        <Empty text={t.countNothing} icon={<ClipboardText size={40} color={c.slate} weight="duotone" />} />
      </Centered>
    );

  const filters: { value: Filter; label: string }[] = [
    { value: 'all', label: t.all },
    { value: 'todo', label: t.notCounted },
    { value: 'diff', label: `${t.different}${different.length ? ` (${different.length})` : ''}` },
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        data={rows}
        keyExtractor={(p) => p.product_id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xl }}
        initialNumToRender={14}
        ListHeaderComponent={
          <View style={{ gap: space.md, paddingTop: space.md, paddingBottom: space.md }}>
            <Text tone="slate" size={14}>
              {stores.length > 1 && store ? t.countIntroStore(store.name) : t.countIntro}
            </Text>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <View style={[styles.searchWrap, { backgroundColor: c.card, borderColor: c.hairline }]}>
                <MagnifyingGlass size={18} color={c.slate} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t.search}
                  placeholderTextColor={c.slate}
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                  style={[styles.search, { color: c.ink }]}
                />
              </View>
              <Pressable
                onPress={scan}
                accessibilityRole="button"
                accessibilityLabel={t.scan}
                style={({ pressed }) => [styles.scanBtn, { backgroundColor: c.ink, opacity: pressed ? 0.8 : 1 }]}>
                <Barcode size={20} color={c.brand} weight="bold" />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {filters.map((f) => {
                const on = filter === f.value;
                return (
                  <Pressable
                    key={f.value}
                    onPress={() => setFilter(f.value)}
                    style={[styles.pill, { backgroundColor: on ? c.ink : c.card, borderColor: on ? c.ink : c.hairline }]}>
                    <Text size={13} weight="600" style={{ color: on ? c.card : c.ink }}>
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {message ? <Text tone={message.tone}>{message.text}</Text> : null}
          </View>
        }
        renderItem={({ item }) => <CountRow p={item} value={draft[item.product_id] ?? ''} onChange={(v) => setCount(item.product_id, v)} />}
        ListEmptyComponent={<Empty text={t.noProducts} />}
      />
      <View style={[styles.footer, { backgroundColor: c.bg, borderTopColor: c.hairline }]}>
        <Text tone="slate" size={13} style={{ textAlign: 'center' }}>
          {t.countProgress(entered.length, products.length, different.length)}
        </Text>
        <Button title={busy ? t.saving : t.saveCount} onPress={save} loading={busy} disabled={!entered.length} />
      </View>
    </KeyboardAvoidingView>
  );
}

function CountRow({ p, value, onChange }: { p: CountProduct; value: string; onChange: (v: string) => void }) {
  const { c, t } = useApp();
  const n = num(value);
  const diff = n === null ? null : n - p.current_stock;
  const unit = p.unit ? ` ${p.unit}` : '';
  return (
    <View style={[styles.row, { borderBottomColor: c.hairline }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text weight="600" numberOfLines={2}>
          {p.name}
        </Text>
        <Text tone="slate" size={12} numberOfLines={1}>
          {[p.sku, p.location].filter(Boolean).join(' · ')}
        </Text>
        <Text size={13} tone="slate">
          {t.inNaqisni}: {qty(p.current_stock)}
          {unit}
          {diff !== null && diff !== 0 ? (
            <Text size={13} weight="700" tone={diff < 0 ? 'alert' : 'brand'}>
              {'  '}
              {diff > 0 ? '+' : ''}
              {qty(diff)}
            </Text>
          ) : null}
          {diff === 0 ? (
            <Text size={13} weight="600" tone="brand">
              {'  '}✓
            </Text>
          ) : null}
        </Text>
      </View>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder="—"
        placeholderTextColor={c.slate}
        accessibilityLabel={`${t.counted}: ${p.name}`}
        selectTextOnFocus
        style={[
          styles.input,
          { backgroundColor: c.card, color: c.ink, borderColor: diff === null ? c.hairline : diff === 0 ? c.brand : c.amber },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: space.md },
  search: { flex: 1, minHeight: 46, fontSize: 16 },
  scanBtn: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  input: { width: 92, minHeight: 48, borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: space.sm, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  footer: { padding: space.lg, paddingBottom: space.xxl, gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
});
