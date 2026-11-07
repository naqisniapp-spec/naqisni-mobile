import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { BusinessGate } from '@/components/business-gate';
import { ProductItem } from '@/components/product-item';
import { ScreenHeader } from '@/components/screen-header';
import { Card, ErrorState, Loading, riskColors, Row, Text } from '@/components/ui';
import { loadAlerts, loadOrders, loadProductRows, type Business } from '@/lib/data';
import type { Risk } from '@/lib/stock';
import { space } from '@/lib/theme';
import { useLoad } from '@/lib/use-load';
import { useApp } from '@/providers/app-provider';

export default function OverviewScreen() {
  const { t } = useApp();
  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title={t.tabOverview} />
      <BusinessGate>{(b) => <Overview business={b} />}</BusinessGate>
    </View>
  );
}

function Overview({ business }: { business: Business }) {
  const { c, t, scopeKey } = useApp();
  const { data, error, loading, refreshing, refresh } = useLoad(
    async () => {
      // Products are the core of this screen; alerts and orders are extras that
      // should never blank it if one of them fails.
      const [rows, alerts, orders] = await Promise.all([
        loadProductRows(business.id),
        loadAlerts(business.id, true).catch(() => []),
        loadOrders(business.id).catch(() => []),
      ]);
      return { rows, alerts, drafts: orders.filter((o) => o.status === 'draft') };
    },
    scopeKey
  );

  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? ''} onRetry={refresh} />;

  const count = (r: Risk) => data.rows.filter((p) => p.risk === r).length;
  const urgent = data.rows.filter((p) => p.risk === 'critical' || p.risk === 'warning').slice(0, 6);
  const tiles: { risk: Risk; label: string }[] = [
    { risk: 'critical', label: t.reorderNow },
    { risk: 'warning', label: t.runningLow },
    { risk: 'ordered', label: t.onOrder },
    { risk: 'healthy', label: t.healthy },
  ];

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.brandDeep} />}>
      <Text tone="slate" style={{ marginBottom: space.md }}>
        {business.name} · {data.rows.length} {t.products}
      </Text>

      <View style={styles.grid}>
        {tiles.map(({ risk, label }) => {
          const { bg, fg } = riskColors(risk, c);
          return (
            <Pressable
              key={risk}
              onPress={() => router.push({ pathname: '/products', params: { filter: risk } })}
              style={({ pressed }) => [styles.tile, { backgroundColor: bg, opacity: pressed ? 0.75 : 1 }]}>
              <Text size={30} weight="800" style={{ color: fg }}>
                {count(risk)}
              </Text>
              <Text size={13} weight="600" style={{ color: fg }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {data.drafts.length > 0 && (
        <Card onPress={() => router.push('/orders')} style={{ marginTop: space.lg, borderColor: c.brand, backgroundColor: c.brandSoft }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text weight="600" style={{ flex: 1 }}>
              {t.ordersToApprove}
            </Text>
            <View style={[styles.badge, { backgroundColor: c.brandDeep }]}>
              <Text size={13} weight="700" style={{ color: c.card }}>
                {data.drafts.length}
              </Text>
            </View>
          </Row>
        </Card>
      )}

      <SectionTitle title={t.needsAttention} onSeeAll={() => router.push('/products')} />
      {urgent.length === 0 ? (
        <Card>
          <Text tone="brand" weight="600">
            {t.allGood}
          </Text>
        </Card>
      ) : (
        urgent.map((p) => <ProductItem key={p.product_id} p={p} />)
      )}

      {data.alerts.length > 0 && (
        <>
          <SectionTitle title={t.latestAlerts} onSeeAll={() => router.push('/alerts')} />
          <Card style={{ paddingVertical: space.sm }}>
            {data.alerts.slice(0, 4).map((a, i) => (
              <Pressable
                key={a.id}
                onPress={() => router.push({ pathname: '/product/[id]', params: { id: a.product_id } })}
                style={[styles.alertRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline }]}>
                <View style={[styles.sev, { backgroundColor: a.severity === 'critical' ? c.alert : a.severity === 'warning' ? c.amber : c.slate }]} />
                <View style={{ flex: 1 }}>
                  <Text weight="600" numberOfLines={1}>
                    {a.products?.name ?? '—'}
                  </Text>
                  <Text tone="slate" size={13} numberOfLines={2}>
                    {a.message}
                  </Text>
                </View>
              </Pressable>
            ))}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

function SectionTitle({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  const { t } = useApp();
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: space.xl, marginBottom: space.sm }}>
      <Text size={18} weight="700">
        {title}
      </Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll} hitSlop={10}>
          <Text tone="brand" weight="600">
            {t.seeAll}
          </Text>
        </Pressable>
      )}
    </Row>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingTop: 0, paddingBottom: space.xxl * 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexBasis: '48%', flexGrow: 1, borderRadius: 16, padding: space.lg, gap: 2 },
  badge: { minWidth: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  alertRow: { flexDirection: 'row', gap: space.md, paddingVertical: space.md, alignItems: 'flex-start' },
  sev: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
});
