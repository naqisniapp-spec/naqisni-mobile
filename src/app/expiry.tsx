import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { BusinessGate } from '@/components/business-gate';
import { Clock } from '@/components/icons';
import { Card, Empty, ErrorState, Loading, Text } from '@/components/ui';
import { daysToExpiry, discardBatch, loadExpiring, type ExpiringBatch } from '@/lib/batches';
import type { Business } from '@/lib/data';
import { qty } from '@/lib/stock';
import { radius, space } from '@/lib/theme';
import { useLoad } from '@/lib/use-load';
import { useApp } from '@/providers/app-provider';

/** Batches with an expiry date still in stock, soonest first, grouped like the website. */
export default function ExpiryScreen() {
  const { t } = useApp();
  return (
    <>
      <Stack.Screen options={{ title: t.expiryDates }} />
      <BusinessGate>{(b) => <Expiry business={b} />}</BusinessGate>
    </>
  );
}

function Expiry({ business }: { business: Business }) {
  const { c, t, lang, scopeKey } = useApp();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => loadExpiring(business.id), scopeKey);
  const [busy, setBusy] = useState<string | null>(null);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? t.error} onRetry={refresh} />;

  const groups = [
    { key: 'expired', title: t.expiredGroup, note: t.expiredNote, test: (d: number) => d < 0, tone: 'alert' as const },
    { key: 'week', title: t.weekGroup, note: t.weekNote, test: (d: number) => d >= 0 && d <= 7, tone: 'alert' as const },
    { key: 'month', title: t.monthGroup, note: t.monthNote, test: (d: number) => d > 7 && d <= 30, tone: 'amber' as const },
    { key: 'later', title: t.laterGroup, note: '', test: (d: number) => d > 30, tone: 'slate' as const },
  ];
  const date = (iso: string) =>
    new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString(lang === 'ar' ? 'ar' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

  function throwAway(b: ExpiringBatch) {
    const amount = `${qty(b.quantity)}${b.products?.unit ? ` ${b.products.unit}` : ''}`;
    Alert.alert(t.throwAwayTitle, t.throwAwayBody(amount, b.products?.name ?? ''), [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.throwAway,
        style: 'destructive',
        onPress: async () => {
          setBusy(b.id);
          try {
            await discardBatch(b.id);
            await reload();
          } catch (e) {
            Alert.alert(t.error, e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.brandDeep} />}>
      <Text tone="slate" size={14}>
        {t.expiryIntro}
      </Text>
      {data.length === 0 ? <Empty text={t.noBatches} icon={<Clock size={40} color={c.slate} weight="duotone" />} /> : null}
      {groups.map((g) => {
        const rows = data.filter((b) => g.test(daysToExpiry(b.expiry_date) ?? Infinity));
        if (!rows.length) return null;
        return (
          <View key={g.key} style={{ gap: space.sm }}>
            <View>
              <Text weight="700" size={17} tone={g.tone}>
                {g.title} ({rows.length})
              </Text>
              {g.note ? (
                <Text tone="slate" size={13}>
                  {g.note}
                </Text>
              ) : null}
            </View>
            <Card style={{ paddingVertical: space.xs }}>
              {rows.map((b, i) => {
                const d = daysToExpiry(b.expiry_date) ?? 0;
                return (
                  <View key={b.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline }]}>
                    <Pressable onPress={() => router.push({ pathname: '/product/[id]', params: { id: b.product_id } })} style={{ flex: 1, gap: 2 }}>
                      <Text weight="600" numberOfLines={2}>
                        {b.products?.name ?? '—'}
                      </Text>
                      <Text tone="slate" size={12}>
                        {qty(b.quantity)}
                        {b.products?.unit ? ` ${b.products.unit}` : ''}
                        {b.batch_code ? ` · ${t.batch} ${b.batch_code}` : ''} · {date(b.expiry_date!)}
                      </Text>
                      <Text size={12} weight="600" tone={g.tone}>
                        {t.expiryLabel(d)}
                      </Text>
                    </Pressable>
                    {d < 0 ? (
                      <Pressable
                        onPress={() => throwAway(b)}
                        disabled={busy === b.id}
                        style={({ pressed }) => [styles.discard, { backgroundColor: c.alertSoft, opacity: busy === b.id ? 0.5 : pressed ? 0.7 : 1 }]}>
                        <Text size={13} weight="700" tone="alert">
                          {t.throwAway}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </Card>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  discard: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
});
