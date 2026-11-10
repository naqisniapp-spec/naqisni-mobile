import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, TextInput, View } from 'react-native';

import { BusinessGate } from '@/components/business-gate';
import { MagnifyingGlass, Truck } from '@/components/icons';
import { Card, Empty, ErrorState, Loading, panel, Row, Text } from '@/components/ui';
import type { Business } from '@/lib/data';
import { loadSuppliers } from '@/lib/suppliers';
import { radius, space } from '@/lib/theme';
import { useLoad } from '@/lib/use-load';
import { useApp } from '@/providers/app-provider';

/** Every supplier from the products and orders, those with products running low first. */
export default function SuppliersScreen() {
  const { t } = useApp();
  return (
    <>
      <Stack.Screen options={{ title: t.suppliers }} />
      <BusinessGate>{(b) => <Suppliers business={b} />}</BusinessGate>
    </>
  );
}

function Suppliers({ business }: { business: Business }) {
  const { c, t, scopeKey } = useApp();
  const { data, error, loading, refreshing, refresh } = useLoad(() => loadSuppliers(business.id), scopeKey);
  const [query, setQuery] = useState('');
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter((s) => !q || s.name.toLowerCase().includes(q) || (s.phone ?? '').includes(q));
  }, [data, query]);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <FlatList
      data={rows}
      keyExtractor={(s) => s.key}
      contentContainerStyle={[panel(c), { gap: space.sm, marginBottom: space.xxl * 2 }]}
      keyboardDismissMode="on-drag"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.brandDeep} />}
      ListHeaderComponent={
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
      }
      ListEmptyComponent={<Empty text={t.noSuppliersYet} icon={<Truck size={40} color={c.slate} weight="duotone" />} />}
      renderItem={({ item: s }) => (
        <Card onPress={() => router.push({ pathname: '/supplier/[key]', params: { key: s.key } })} style={{ gap: 4 }}>
          <Row style={{ justifyContent: 'space-between', gap: space.sm }}>
            <Text weight="700" size={16} style={{ flex: 1 }} numberOfLines={1}>
              {s.name}
            </Text>
            {s.low > 0 ? (
              <View style={[styles.badge, { backgroundColor: c.alertSoft }]}>
                <Text size={12} weight="700" tone="alert">
                  {t.lowShort(s.low)}
                </Text>
              </View>
            ) : null}
          </Row>
          <Text tone="slate" size={13}>
            {[s.phone ?? t.noPhone, t.productsCount(s.products.length), s.openOrders ? t.openOrdersCount(s.openOrders) : null].filter(Boolean).join(' · ')}
          </Text>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: space.md, marginBottom: space.sm },
  search: { flex: 1, minHeight: 46, fontSize: 16 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
});
