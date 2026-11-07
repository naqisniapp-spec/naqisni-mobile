import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { BusinessGate } from '@/components/business-gate';
import { ProductItem } from '@/components/product-item';
import { ScreenHeader } from '@/components/screen-header';
import { Empty, ErrorState, Loading, Text } from '@/components/ui';
import { loadProductRows, type Business } from '@/lib/data';
import type { Risk } from '@/lib/stock';
import { radius, space } from '@/lib/theme';
import { useLoad } from '@/lib/use-load';
import { useApp } from '@/providers/app-provider';

type Filter = 'all' | Risk;

export default function ProductsScreen() {
  const { c, t } = useApp();
  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title={t.tabProducts}
        right={
          <Pressable
            onPress={() => router.push('/scan')}
            style={({ pressed }) => [styles.scanBtn, { backgroundColor: c.ink, opacity: pressed ? 0.8 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel={t.scan}>
            <Text size={14} weight="700" style={{ color: c.card }}>
              ⌁ {t.scan}
            </Text>
          </Pressable>
        }
      />
      <BusinessGate>{(b) => <Products business={b} />}</BusinessGate>
    </View>
  );
}

function Products({ business }: { business: Business }) {
  const { c, t, scopeKey } = useApp();
  const params = useLocalSearchParams<{ filter?: string }>();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>((params.filter as Filter) ?? 'all');
  const [seenParam, setSeenParam] = useState(params.filter);
  const { data, error, loading, refreshing, refresh } = useLoad(() => loadProductRows(business.id), scopeKey);

  // Tapping a tile on the Overview opens this tab already filtered.
  if (params.filter !== seenParam) {
    setSeenParam(params.filter);
    if (params.filter) setFilter(params.filter as Filter);
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter(
      (p) =>
        (filter === 'all' || p.risk === filter) &&
        (!q || p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q) || (p.barcode ?? '').includes(q))
    );
  }, [data, query, filter]);

  const filters: { value: Filter; label: string }[] = [
    { value: 'all', label: t.all },
    { value: 'critical', label: t.reorderNow },
    { value: 'warning', label: t.runningLow },
    { value: 'ordered', label: t.onOrder },
    { value: 'healthy', label: t.healthy },
  ];

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <FlatList
      data={rows}
      keyExtractor={(p) => p.product_id}
      renderItem={({ item }) => <ProductItem p={item} />}
      contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxl * 2 }}
      keyboardDismissMode="on-drag"
      initialNumToRender={14}
      windowSize={9}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.brandDeep} />}
      ListHeaderComponent={
        <View style={{ marginBottom: space.md }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t.search}
            placeholderTextColor={c.slate}
            autoCorrect={false}
            clearButtonMode="while-editing"
            style={[styles.search, { backgroundColor: c.card, borderColor: c.hairline, color: c.ink }]}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingTop: space.md }}>
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
          </ScrollView>
        </View>
      }
      ListEmptyComponent={<Empty text={t.noProducts} />}
    />
  );
}

const styles = StyleSheet.create({
  search: { minHeight: 46, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: space.lg, fontSize: 16 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  scanBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
});
