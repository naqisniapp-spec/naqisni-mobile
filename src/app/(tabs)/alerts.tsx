import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { BusinessGate } from '@/components/business-gate';
import { CheckCircle, TrendDown, Warning } from '@/components/icons';
import { ScreenHeader } from '@/components/screen-header';
import { Card, Empty, ErrorState, Loading, Row, Segmented, Text } from '@/components/ui';
import { acknowledgeAlert, loadAlerts, type Business } from '@/lib/data';
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
  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => loadAlerts(business.id, tab === 'open'), `${scopeKey}:${tab}`);
  const [seen, setSeen] = useState<Set<string>>(new Set());

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
          ]}
        />
      </View>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxl * 2 }}
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

const styles = StyleSheet.create({
  sevIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ack: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1 },
});
