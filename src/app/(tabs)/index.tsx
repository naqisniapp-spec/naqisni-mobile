import { router } from 'expo-router';
import type { ComponentType } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BusinessGate } from '@/components/business-gate';
import { ArrowsDownUp, Barcode, CaretRight, ChatCircleDots, CheckCircle, Package, TrendDown, Truck, Warning } from '@/components/icons';
import { Logo } from '@/components/logo';
import { ProductItem } from '@/components/product-item';
import { StorePill } from '@/components/screen-header';
import { Card, ErrorState, Loading, riskColors, Row, Text } from '@/components/ui';
import { loadAlerts, loadOrders, loadProductRows, type Business } from '@/lib/data';
import type { Risk } from '@/lib/stock';
import { palette, space, topBarSpace } from '@/lib/theme';
import { useLoad } from '@/lib/use-load';
import { useApp } from '@/providers/app-provider';

type IconType = ComponentType<{ size?: number; color?: string; weight?: 'regular' | 'bold' | 'fill' | 'duotone' }>;

export default function OverviewScreen() {
  const { c } = useApp();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BusinessGate>{(b) => <Overview business={b} />}</BusinessGate>
    </View>
  );
}

function greeting(t: ReturnType<typeof useApp>['t']) {
  const h = new Date().getHours();
  return h < 12 ? t.goodMorning : h < 17 ? t.goodAfternoon : t.goodEvening;
}

function Overview({ business }: { business: Business }) {
  const { c, t, rtl, dark, scopeKey } = useApp();
  const insets = useSafeAreaInsets();
  const { data, error, loading, refreshing, refresh } = useLoad(
    async () => {
      // Products are the core of this screen; alerts and orders are extras that
      // should never blank it if one of them fails.
      const [rows, alerts, orders] = await Promise.all([
        loadProductRows(business.id),
        loadAlerts(business.id, true).catch(() => []),
        loadOrders(business.id).catch(() => []),
      ]);
      return { rows, alerts, drafts: orders.filter((o) => o.status === 'draft'), onTheWay: orders.filter((o) => o.status === 'open').length };
    },
    scopeKey
  );

  const count = (r: Risk) => (data?.rows ?? []).filter((p) => p.risk === r).length;
  const critical = count('critical');
  const warning = count('warning');

  // The header sits straight on the page colour (light or dark), with soft green glows behind it.
  const hero = (
    <View style={[styles.hero, { paddingTop: insets.top + topBarSpace + space.md }]}>
      <View pointerEvents="none" style={[styles.glow, { width: 96, height: 96, end: 18, top: insets.top + 6, backgroundColor: c.brand, opacity: dark ? 0.16 : 0.18 }]} />
      <View pointerEvents="none" style={[styles.glow, { width: 60, height: 60, end: 8, top: insets.top + 122, backgroundColor: c.brand, opacity: dark ? 0.1 : 0.12 }]} />
      <View pointerEvents="none" style={[styles.glow, { width: 66, height: 66, start: -22, bottom: -6, backgroundColor: c.brand, opacity: dark ? 0.12 : 0.14 }]} />
      <Row style={{ justifyContent: 'space-between', gap: space.md }}>
        <Logo width={108} />
        <StorePill />
      </Row>
      <Text size={15} tone="slate" style={{ marginTop: space.xl }}>
        {greeting(t)}
      </Text>
      <Text size={28} weight="700" numberOfLines={1} style={{ marginTop: 2, letterSpacing: -0.4 }}>
        {business.name}
      </Text>
      {data && (
        <Row style={{ gap: space.sm, marginTop: space.sm }}>
          {critical > 0 ? (
            <Warning size={18} color={c.alert} weight="fill" />
          ) : (
            <CheckCircle size={18} color={c.brandDeep} weight="fill" />
          )}
          <Text tone="slate" numberOfLines={2} style={{ flex: 1 }}>
            {critical > 0
              ? `${t.toReorder(critical)}${warning > 0 ? ` · ${t.lowSoon(warning)}` : ''}`
              : warning > 0
                ? t.lowCount(warning)
                : `${t.allHealthyTitle} · ${t.allHealthySub}`}
          </Text>
        </Row>
      )}
    </View>
  );

  if (loading)
    return (
      <View style={{ flex: 1 }}>
        {hero}
        <Loading />
      </View>
    );
  if (error || !data)
    return (
      <View style={{ flex: 1 }}>
        {hero}
        <ErrorState message={error ?? ''} onRetry={refresh} />
      </View>
    );

  const urgent = data.rows.filter((p) => p.risk === 'critical' || p.risk === 'warning').slice(0, 6);
  const tiles: { risk: Risk; label: string; Icon: IconType }[] = [
    { risk: 'critical', label: t.reorderNow, Icon: Warning },
    { risk: 'warning', label: t.runningLow, Icon: TrendDown },
    { risk: 'ordered', label: t.onOrder, Icon: Truck },
    { risk: 'healthy', label: t.healthy, Icon: CheckCircle },
  ];
  const actions: { label: string; Icon: IconType; go: () => void; badge?: number }[] = [
    { label: t.quickScan, Icon: Barcode, go: () => router.push('/scan') },
    { label: t.quickRecord, Icon: ArrowsDownUp, go: () => router.push('/products') },
    { label: t.quickOrders, Icon: Truck, go: () => router.push('/orders'), badge: data.drafts.length },
    { label: t.quickSupport, Icon: ChatCircleDots, go: () => router.push('/support') },
  ];

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: space.xxl * 2 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.brand} progressViewOffset={insets.top} />}>
      {hero}

      {/* Everything below the header sits on one soft rounded panel */}
      <View style={[styles.body, { backgroundColor: dark ? palette.light.ink : 'rgba(255,255,255,0.7)', borderColor: c.hairline }]}>
        {/* Status tiles */}
        <View style={styles.tiles}>
          {tiles.map(({ risk, label, Icon }) => {
            const { bg, fg } = riskColors(risk, c);
            return (
              <Pressable
                key={risk}
                onPress={() => router.push({ pathname: '/products', params: { filter: risk } })}
                style={({ pressed }) => [styles.tile, { backgroundColor: c.card, borderColor: c.hairline, opacity: pressed ? 0.8 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={`${label}: ${count(risk)}`}>
                <Row style={{ gap: space.md }}>
                  <View style={[styles.tileIcon, { backgroundColor: bg }]}>
                    <Icon size={20} color={fg} weight="bold" />
                  </View>
                  <Text size={30} weight="700" style={{ lineHeight: 36 }}>
                    {count(risk)}
                  </Text>
                </Row>
                <Text size={14} tone="slate" weight="500" numberOfLines={1} style={{ marginTop: space.md }}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Quick actions */}
        <View style={styles.actions}>
          {actions.map(({ label, Icon, go, badge }) => (
            <Pressable key={label} onPress={go} style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]} accessibilityRole="button">
              <View style={[styles.actionIcon, { backgroundColor: c.card, borderColor: c.hairline }]}>
                <Icon size={24} color={c.brandDeep} weight="duotone" />
                {badge ? (
                  <View style={[styles.badge, { backgroundColor: c.alert, borderColor: c.bg }]}>
                    <Text size={11} weight="700" style={{ color: '#FFFFFF' }}>
                      {badge}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text size={12} weight="500" numberOfLines={1} style={{ textAlign: 'center' }}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {data.drafts.length > 0 && (
          <Card onPress={() => router.push('/orders')} style={{ borderColor: c.brand, backgroundColor: c.brandSoft, marginTop: space.lg }}>
            <Row style={{ gap: space.md }}>
              <Truck size={22} color={c.brandDeep} weight="duotone" />
              <Text weight="600" style={{ flex: 1 }}>
                {t.ordersToApprove}
              </Text>
              <View style={[styles.count, { backgroundColor: c.brandDeep }]}>
                <Text size={13} weight="700" style={{ color: c.card }}>
                  {data.drafts.length}
                </Text>
              </View>
            </Row>
          </Card>
        )}

        <SectionTitle title={t.needsAttention} onSeeAll={() => router.push({ pathname: '/products', params: { filter: 'critical' } })} />
        {urgent.length === 0 ? (
          <Card style={{ alignItems: 'center', paddingVertical: space.xl, gap: space.sm }}>
            <Package size={32} color={c.brandDeep} weight="duotone" />
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
            <Card style={{ paddingVertical: space.xs }}>
              {data.alerts.slice(0, 4).map((a, i) => (
                <Pressable
                  key={a.id}
                  onPress={() => router.push({ pathname: '/product/[id]', params: { id: a.product_id } })}
                  style={[styles.alertRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline }]}>
                  <View style={[styles.sevDot, { backgroundColor: a.severity === 'critical' ? c.alert : a.severity === 'warning' ? c.amber : c.slate }]} />
                  <View style={{ flex: 1 }}>
                    <Text weight="600" numberOfLines={1}>
                      {a.products?.name ?? '—'}
                    </Text>
                    <Text tone="slate" size={13} numberOfLines={2}>
                      {a.message}
                    </Text>
                  </View>
                  <CaretRight size={14} color={c.slate} style={rtl ? { transform: [{ scaleX: -1 }] } : undefined} />
                </Pressable>
              ))}
            </Card>
          </>
        )}
      </View>
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
          <Text tone="brand" weight="600" size={14}>
            {t.seeAll}
          </Text>
        </Pressable>
      )}
    </Row>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: space.xl, paddingBottom: space.xl, overflow: 'hidden' },
  glow: { position: 'absolute', borderRadius: 999 },
  body: {
    marginHorizontal: space.md,
    padding: space.md,
    paddingBottom: space.lg,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: {
    flexBasis: '45%',
    flexGrow: 1,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.lg,
    shadowColor: '#10182B',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  tileIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xl },
  action: { flex: 1, alignItems: 'center', gap: 6 },
  actionIcon: { width: 56, height: 56, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -5,
    end: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  count: { minWidth: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  alertRow: { flexDirection: 'row', gap: space.md, paddingVertical: space.md, alignItems: 'center' },
  sevDot: { width: 10, height: 10, borderRadius: 5 },
});
