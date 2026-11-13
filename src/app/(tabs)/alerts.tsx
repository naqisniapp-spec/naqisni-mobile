import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { BusinessGate } from '@/components/business-gate';
import { CheckCircle, TrendDown, Warning } from '@/components/icons';
import { ScreenHeader } from '@/components/screen-header';
import { Card, Empty, ErrorState, Loading, panel, Row, Segmented, Text } from '@/components/ui';
import { acknowledgeAlert, countOpenMovementAlerts, loadAlerts, loadMovementAlerts, reviewMovementAlert, type Business, type MovementAlert } from '@/lib/data';
import { radius, space } from '@/lib/theme';
import { useLoad } from '@/lib/use-load';
import { useApp } from '@/providers/app-provider';

export default function AlertsScreen() {
  const { t } = useApp();
  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title={t.tabAlerts} />
      <BusinessGate>{(b) => <Alerts business={b} />}</BusinessGate>
    </View>
  );
}

function when(iso: string, lang: string) {
  return new Date(iso).toLocaleString(lang === 'ar' ? 'ar' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function Alerts({ business }: { business: Business }) {
  const { c, t, lang, scopeKey, allStores, storeName } = useApp();
  const isOwner = business.role === 'owner';
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<'open' | 'resolved' | 'movements'>(isOwner && params.tab === 'movements' ? 'movements' : 'open');
  // A notification about unusual movements opens that list (also when this tab is already open).
  const [lastParam, setLastParam] = useState(params.tab);
  if (params.tab !== lastParam) {
    setLastParam(params.tab);
    if (isOwner && params.tab === 'movements') setTab('movements');
  }
  const { data, error, loading, refreshing, refresh, reload } = useLoad(
    () => (tab === 'movements' ? Promise.resolve([]) : loadAlerts(business.id, tab === 'open')),
    `${scopeKey}:${tab}`
  );
  const [seen, setSeen] = useState<Set<string>>(new Set());
  // Movements still to check, shown on the Unusual tab (refreshed after each review).
  const [reviews, setReviews] = useState(0);
  const toCheck = useLoad(() => (isOwner ? countOpenMovementAlerts(business.id) : Promise.resolve(0)), `movcount:${business.id}:${reviews}`);
  const openMoves = toCheck.data ?? 0;

  async function ack(id: string) {
    setSeen((s) => new Set(s).add(id));
    try {
      await acknowledgeAlert(id);
    } catch {
      reload();
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'open', label: t.openAlerts },
            { value: 'resolved', label: t.resolved },
            ...(isOwner ? [{ value: 'movements' as const, label: openMoves ? `${t.unusualTab} (${openMoves})` : t.unusualTab }] : []),
          ]}
        />
      </View>
      {tab === 'movements' ? (
        <Movements business={business} onReviewed={() => setReviews((n) => n + 1)} />
      ) : loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(a) => a.id}
          contentContainerStyle={[panel(c), { marginBottom: space.xxl * 2 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.brandDeep} />}
          ListEmptyComponent={<Empty text={t.noAlerts} icon={<CheckCircle size={40} color={c.brandDeep} weight="duotone" />} />}
          renderItem={({ item: a }) => {
            const color = a.severity === 'critical' ? c.alert : a.severity === 'warning' ? c.amber : c.slate;
            const isSeen = a.acknowledged || seen.has(a.id);
            return (
              <Card onPress={() => router.push({ pathname: '/product/[id]', params: { id: a.product_id } })} style={{ marginBottom: space.sm }}>
                <Row style={{ gap: space.md, alignItems: 'flex-start' }}>
                  <View style={[styles.sevIcon, { backgroundColor: a.severity === 'critical' ? c.alertSoft : c.amberSoft }]}>
                    {a.severity === 'critical' ? <Warning size={18} color={color} weight="fill" /> : <TrendDown size={18} color={color} weight="bold" />}
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text weight="600">{a.products?.name ?? '—'}</Text>
                    <Text tone="slate" size={14}>
                      {a.message}
                    </Text>
                    <Text tone="slate" size={12}>
                      {when(a.created_at, lang)}
                      {allStores && storeName(a.products?.store_id) ? `  ·  ${storeName(a.products?.store_id)}` : ''}
                    </Text>
                  </View>
                  {tab === 'open' &&
                    (isSeen ? (
                      <Text tone="slate" size={12}>
                        {t.acknowledged}
                      </Text>
                    ) : (
                      <Pressable onPress={() => ack(a.id)} hitSlop={8} style={[styles.ack, { borderColor: c.hairline }]}>
                        <Text size={13} weight="600" tone="brand">
                          {t.acknowledge}
                        </Text>
                      </Pressable>
                    ))}
                </Row>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}

/** Unusual stock movements (owner only): to check first, then reviewed. */
function Movements({ business, onReviewed }: { business: Business; onReviewed: () => void }) {
  const { c, t, lang, allStores, storeName } = useApp();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(async () => {
    const [open, done] = await Promise.all([loadMovementAlerts(business.id, true), loadMovementAlerts(business.id, false)]);
    return [...open, ...done];
  }, `movements:${business.id}`);
  const [local, setLocal] = useState<Record<string, MovementAlert['review_outcome'] | 'open'>>({});

  async function review(id: string, outcome: 'expected' | 'problem' | null) {
    setLocal((s) => ({ ...s, [id]: outcome ?? 'open' }));
    try {
      await reviewMovementAlert(id, outcome);
      onReviewed();
    } catch {
      setLocal((s) => {
        const next = { ...s };
        delete next[id];
        return next;
      });
      reload();
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;
  return (
    <FlatList
      data={data ?? []}
      keyExtractor={(a) => a.id}
      contentContainerStyle={[panel(c), { marginBottom: space.xxl * 2 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.brandDeep} />}
      ListHeaderComponent={
        <Text tone="slate" size={13} style={{ marginBottom: space.md }}>
          {t.unusualHint}
        </Text>
      }
      ListEmptyComponent={<Empty text={t.noUnusual} icon={<CheckCircle size={40} color={c.brandDeep} weight="duotone" />} />}
      renderItem={({ item: a }) => {
        const state = local[a.id];
        const outcome = state === 'open' ? null : state !== undefined ? state : a.reviewed_at ? a.review_outcome ?? 'expected' : null;
        const critical = a.severity === 'critical';
        const color = critical ? c.alert : c.amber;
        return (
          <Card
            onPress={a.product_id ? () => router.push({ pathname: '/product/[id]', params: { id: a.product_id as string } }) : undefined}
            style={{ marginBottom: space.sm, opacity: outcome === 'expected' ? 0.7 : 1 }}>
            <Row style={{ gap: space.md, alignItems: 'flex-start' }}>
              <View style={[styles.sevIcon, { backgroundColor: critical ? c.alertSoft : c.amberSoft }]}>
                <Warning size={18} color={color} weight={critical ? 'fill' : 'bold'} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Row style={{ gap: space.sm, flexWrap: 'wrap' }}>
                  <Text weight="600">{a.product_name ?? '—'}</Text>
                  <Text size={12} weight="600" style={{ color: outcome === 'problem' ? c.alert : outcome ? c.slate : color }}>
                    {outcome === 'problem' ? t.markedProblem : outcome ? t.markedExpected : critical ? t.movementCheckNow : t.movementWorthLook}
                  </Text>
                </Row>
                <Text tone="slate" size={14}>
                  {a.message}
                </Text>
                <Text tone="slate" size={12}>
                  {when(a.occurred_at, lang)}
                  {allStores && storeName(a.store_id) ? `  ·  ${storeName(a.store_id)}` : ''}
                </Text>
                <Row style={{ gap: space.sm, marginTop: space.xs, flexWrap: 'wrap' }}>
                  {outcome ? (
                    <Pressable onPress={() => review(a.id, null)} hitSlop={8} style={[styles.ack, { borderColor: c.hairline }]}>
                      <Text size={13} weight="600" tone="slate">
                        {t.reopen}
                      </Text>
                    </Pressable>
                  ) : (
                    <>
                      <Pressable onPress={() => review(a.id, 'expected')} hitSlop={8} style={[styles.ack, { borderColor: c.hairline }]}>
                        <Text size={13} weight="600" tone="brand">
                          {t.movementExpected}
                        </Text>
                      </Pressable>
                      <Pressable onPress={() => review(a.id, 'problem')} hitSlop={8} style={[styles.ack, { borderColor: c.alert }]}>
                        <Text size={13} weight="600" style={{ color: c.alert }}>
                          {t.movementProblem}
                        </Text>
                      </Pressable>
                    </>
                  )}
                </Row>
              </View>
            </Row>
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  sevIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ack: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1 },
});
