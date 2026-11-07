import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { BusinessGate } from '@/components/business-gate';
import { ScreenHeader } from '@/components/screen-header';
import { Card, Empty, ErrorState, Loading, Row, Segmented, Text } from '@/components/ui';
import { loadOrders, type Business } from '@/lib/data';
import { space } from '@/lib/theme';
import { useLoad } from '@/lib/use-load';
import { useApp } from '@/providers/app-provider';

export default function OrdersScreen() {
  const { t } = useApp();
  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title={t.tabOrders} />
      <BusinessGate>{(b) => <Orders business={b} />}</BusinessGate>
    </View>
  );
}

function Orders({ business }: { business: Business }) {
  const { c, t, lang, scopeKey } = useApp();
  const [tab, setTab] = useState<'draft' | 'open'>('draft');
  const { data, error, loading, refreshing, refresh } = useLoad(() => loadOrders(business.id), scopeKey);
  const rows = (data ?? []).filter((o) => o.status === tab);
  const drafts = (data ?? []).filter((o) => o.status === 'draft').length;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md }}>
        <Segmented
          value={tab}
          onChange={setTab}
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
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxl * 2 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.brandDeep} />}
          ListEmptyComponent={<Empty text={t.noOrders} />}
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
