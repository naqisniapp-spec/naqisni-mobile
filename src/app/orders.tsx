import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { BusinessGate } from '@/components/business-gate';
import { Plus, Truck } from '@/components/icons';
import { StorePill } from '@/components/screen-header';
import { Card, Empty, ErrorState, Loading, panel, Row, Segmented, Text } from '@/components/ui';
import { loadOrders, type Business } from '@/lib/data';
import { space } from '@/lib/theme';
import { useLoad } from '@/lib/use-load';
import { useApp } from '@/providers/app-provider';
import { gated } from '@/components/app-gate';

function OrdersScreen() {
  const { c, t } = useApp();
  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: t.tabOrders,
          headerRight: () => (
          <Pressable
            onPress={() => router.push('/new-order')}
            accessibilityRole="button"
            accessibilityLabel={t.newOrder}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 14,
              paddingVertical: 9,
              borderRadius: 999,
              backgroundColor: c.brand,
              opacity: pressed ? 0.8 : 1,
            })}>
            <Plus size={16} color={c.onBrand} weight="bold" />
            <Text size={14} weight="600" style={{ color: c.onBrand }}>
              {t.newOrder}
            </Text>
          </Pressable>
          ),
        }}
      />
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, alignItems: 'flex-start' }}>
        <StorePill />
      </View>
      <BusinessGate>{(b) => <Orders business={b} />}</BusinessGate>
    </View>
  );
}

function Orders({ business }: { business: Business }) {
  const { c, t, lang, scopeKey, allStores, storeName } = useApp();
  const [picked, setPicked] = useState<'draft' | 'open' | null>(null);
  const { data, error, loading, refreshing, refresh } = useLoad(() => loadOrders(business.id), scopeKey);
  const drafts = (data ?? []).filter((o) => o.status === 'draft').length;
  // Until the person picks a tab: show drafts if any are waiting, otherwise orders on the way.
  const tab = picked ?? (drafts > 0 ? 'draft' : 'open');
  const rows = (data ?? []).filter((o) => o.status === tab);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md }}>
        <Segmented
          value={tab}
          onChange={setPicked}
          options={[
            { value: 'draft', label: drafts ? `${t.drafts} (${drafts})` : t.drafts },
            { value: 'open', label: t.open },
          ]}
        />
      </View>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(o) => o.id}
          contentContainerStyle={[panel(c), { marginBottom: space.xxl * 2 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.brandDeep} />}
          ListEmptyComponent={<Empty text={t.noOrders} icon={<Truck size={40} color={c.slate} weight="duotone" />} />}
          renderItem={({ item: o }) => (
            <Card onPress={() => router.push({ pathname: '/order/[id]', params: { id: o.id } })} style={{ marginBottom: space.sm, gap: 4 }}>
              <Row style={{ justifyContent: 'space-between', gap: space.sm }}>
                <Text weight="700" size={16} style={{ flex: 1 }} numberOfLines={1}>
                  {o.supplier_name ?? '—'}
                </Text>
                {o.auto && (
                  <Text size={12} weight="600" tone="brand">
                    {t.autoOrder}
                  </Text>
                )}
              </Row>
              {o.status === 'open' && !o.sent_at && !o.auto ? (
                <Text tone="amber" size={12} weight="600">
                  {t.notSentYet}
                </Text>
              ) : null}
              {allStores && storeName(o.store_id) ? (
                <Text tone="slate" size={12} weight="600">
                  {storeName(o.store_id)}
                </Text>
              ) : null}
              <Text tone="slate" size={14}>
                {o.purchase_order_lines.length} {t.items}
                {o.expected_at
                  ? `  ·  ${t.expected} ${new Date(o.expected_at + 'T00:00:00Z').toLocaleDateString(lang === 'ar' ? 'ar' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}`
                  : ''}
              </Text>
              <Text tone="slate" size={13} numberOfLines={1}>
                {o.purchase_order_lines
                  .slice(0, 3)
                  .map((l) => l.products?.name)
                  .filter(Boolean)
                  .join(', ')}
              </Text>
            </Card>
          )}
        />
      )}
    </View>
  );
}

export default gated('orders', OrdersScreen);
