import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, type ComponentType } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AskBar } from '@/components/ask-bar';
import { BusinessGate } from '@/components/business-gate';
import { ArrowsDownUp, Barcode, CaretRight, ChatCircleDots, CheckCircle, Package, TrendDown, Truck, Warning } from '@/components/icons';
import { Logo } from '@/components/logo';
import { ProductItem } from '@/components/product-item';
import { StorePill } from '@/components/screen-header';
import { Card, ErrorState, Loading, riskColors, Row, Text } from '@/components/ui';
import { loadAlerts, loadOrders, loadProductRows, type Business } from '@/lib/data';
import type { Risk } from '@/lib/stock';
import { palette, radius, space, topBarSpace } from '@/lib/theme';
import { useLoad } from '@/lib/use-load';
import { useApp } from '@/providers/app-provider';

const INK = palette.light.ink;

type IconType = ComponentType<{ size?: number; color?: string; weight?: 'regular' | 'bold' | 'fill' | 'duotone' }>;

export default function OverviewScreen() {
  const { c, dark } = useApp();
  // Light status bar text over the dark header; back to normal on other tabs.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle(dark ? 'light' : 'dark');
    }, [dark])
  );
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
  const { c, t, rtl, scopeKey } = useApp();
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

  const hero = (
    <View style={[styles.hero, { paddingTop: insets.top + topBarSpace + space.md }]}>
      <Row style={{ justifyContent: 'space-between', gap: space.md }}>
        <Logo width={104} />
        <StorePill onDark />
      </Row>
      <Text size={15} style={{ color: 'rgba(255,255,255,0.65)', marginTop: space.xl }}>
        {greeting(t)}
      </Text>
      <Text size={24} weight="700" numberOfLines={1} style={{ color: '#FFFFFF', marginTop: 2 }}>
        {business.name}
      </Text>
      {data && (
        <View style={styles.summary}>
          {critical > 0 ? (
            <Warning size={22} color={palette.dark.alert} weight="fill" />
          ) : (
            <CheckCircle size={22} color={c.brand} weight="fill" />
          )}
          <View style={{ flex: 1 }}>
            <Text weight="600" style={{ color: '#FFFFFF' }}>
              {critical > 0 ? t.toReorder(critical) : warning > 0 ? t.lowCount(warning) : t.allHealthyTitle}
            </Text>
            <Text size={13} style={{ color: 'rgba(255,255,255,0.6)' }}>
              {critical > 0 && warning > 0 ? t.lowSoon(warning) : critical === 0 && warning === 0 ? t.allHealthySub : ''}
            </Text>
          </View>
        </View>
      )}
      <AskBar businessId={business.id} />
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

      <View style={styles.body}>
        {/* Status tiles, lifted onto the dark header */}
        <View style={[styles.tiles, { marginTop: -40 }]}>
          {tiles.map(({ risk, label, Icon }) => {
            const { bg, fg } = riskColors(risk, c);
            return (
              <Pressable
                key={risk}
                onPress={() => router.push({ pathname: '/products', params: { filter: risk } })}
                style={({ pressed }) => [styles.tile, { backgroundColor: c.card, borderColor: c.hairline, opacity: pressed ? 0.8 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={`${label}: ${count(risk)}`}>
                <View style={[styles.tileIcon, { backgroundColor: bg }]}>
                  <Icon size={20} color={fg} weight="bold" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text size={22} weight="700" style={{ lineHeight: 26 }}>
                    {count(risk)}
                  </Text>
                  <Text size={12} tone="slate" weight="500" numberOfLines={1}>
                    {label}
                  </Text>
                </View>
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
  hero: {
    backgroundColor: INK,
    paddingHorizontal: space.lg,
    paddingBottom: 60,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.lg,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  body: { paddingHorizontal: space.lg },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.md,
    paddingVertical: 14,
    shadowColor: '#10182B',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
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
