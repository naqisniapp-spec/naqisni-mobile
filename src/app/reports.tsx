import * as WebBrowser from 'expo-web-browser';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { BusinessGate } from '@/components/business-gate';
import { Button, Card, Empty, ErrorState, Loading, panel, Row, Text } from '@/components/ui';
import type { Business } from '@/lib/data';
import { formatAmount, loadReport, SLOW_MONTHS } from '@/lib/reports';
import { qty } from '@/lib/stock';
import { WEB_URL } from '@/lib/supabase';
import { radius, space } from '@/lib/theme';
import { useLoad } from '@/lib/use-load';
import { useApp } from '@/providers/app-provider';

const PERIODS = [7, 30, 90] as const;

/** What the stock is worth, what moves fast and what sits on the shelf — the website's Reports page, for the phone. */
export default function ReportsScreen() {
  const { t } = useApp();
  return (
    <>
      <Stack.Screen options={{ title: t.reports }} />
      <BusinessGate>{(b) => <Reports business={b} />}</BusinessGate>
    </>
  );
}

function Reports({ business }: { business: Business }) {
  const { c, t, scopeKey } = useApp();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(30);
  const [now] = useState(() => Date.now());
  const { data: r, error, loading, refreshing, refresh } = useLoad(() => loadReport(business.id, period, now), `${scopeKey}:${period}`);

  const header = (
    <Row style={{ gap: space.sm }}>
      {PERIODS.map((p) => {
        const on = p === period;
        return (
          <Pressable
            key={p}
            onPress={() => setPeriod(p)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[styles.pill, { backgroundColor: on ? c.ink : c.card, borderColor: on ? c.ink : c.hairline }]}>
            <Text size={13} weight="600" style={{ color: on ? c.card : c.ink }}>
              {t.lastDays(p)}
            </Text>
          </Pressable>
        );
      })}
    </Row>
  );

  if (loading) return <Loading />;
  if (error || !r) return <ErrorState message={error ?? t.error} onRetry={refresh} />;
  const money = (n: number) => formatAmount(n, r.currency);

  return (
    <ScrollView
      contentContainerStyle={[panel(c), { gap: space.lg, marginBottom: space.xxl * 2 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.brandDeep} />}>
      {header}
      {r.products === 0 ? (
        <Empty text={t.reportsEmpty} />
      ) : (
        <>
          <View style={styles.stats}>
            <Stat label={t.stockValueCost} value={money(r.stockAtCost)} note={r.missingCost ? t.withoutCost(r.missingCost) : undefined} />
            <Stat label={t.stockValueSell} value={r.missingSell < r.products ? money(r.stockAtSell) : '—'} note={r.missingSell ? t.withoutSell(r.missingSell) : undefined} />
            <Stat label={t.unitsOut} value={qty(r.unitsOut)} note={t.productsMoved(r.productsMoved)} />
            <Stat label={t.valueOut} value={money(r.valueOut)} note={t.atCost} />
          </View>

          <Card style={{ gap: space.sm }}>
            <Text size={17} weight="700">
              {t.bestSellers}
            </Text>
            <Text tone="slate" size={13}>
              {t.bestSellersHint}
            </Text>
            {r.fastMovers.length === 0 ? (
              <Text tone="slate">{t.nothingMoved}</Text>
            ) : (
              r.fastMovers.map((m, i) => (
                <Pressable
                  key={m.product.product_id}
                  onPress={() => router.push({ pathname: '/product/[id]', params: { id: m.product.product_id } })}
                  style={({ pressed }) => [styles.line, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline }, pressed && { opacity: 0.6 }]}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text weight="600" numberOfLines={1}>
                      {m.product.name}
                    </Text>
                    <View style={[styles.bar, { backgroundColor: c.hairline }]}>
                      <View style={[styles.barFill, { width: `${Math.max(3, Math.round(m.share * 100))}%`, backgroundColor: c.brand }]} />
                    </View>
                  </View>
                  <Text weight="700">
                    {qty(m.units)}
                    {m.product.unit ? ` ${m.product.unit}` : ''}
                  </Text>
                </Pressable>
              ))
            )}
          </Card>

          <Card style={{ gap: space.sm }}>
            <Text size={17} weight="700">
              {t.slowMovers}
            </Text>
            <Text tone="slate" size={13}>
              {r.noMovement ? t.slowNoMovement : t.slowHint(SLOW_MONTHS, money(r.slowTiedUp))}
            </Text>
            {r.slowMovers.slice(0, 10).map((m, i) => (
              <Pressable
                key={m.product.product_id}
                onPress={() => router.push({ pathname: '/product/[id]', params: { id: m.product.product_id } })}
                style={({ pressed }) => [styles.line, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline }, pressed && { opacity: 0.6 }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text weight="600" numberOfLines={1}>
                    {m.product.name}
                  </Text>
                  <Text tone="slate" size={12}>
                    {t.stock} {qty(m.stock)}
                    {m.product.unit ? ` ${m.product.unit}` : ''} ·{' '}
                    {m.unitsOut ? t.monthsOfStock(Math.round(m.monthsOfStock ?? 0)) : t.noneMoved}
                  </Text>
                </View>
                <Text weight="700" tone="amber">
                  {m.tiedUp === null ? '—' : money(m.tiedUp)}
                </Text>
              </Pressable>
            ))}
          </Card>

          <Button title={t.fullReports} variant="secondary" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/dashboard/reports/period?kind=month`)} />
        </>
      )}
    </ScrollView>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  const { c } = useApp();
  return (
    <View style={[styles.stat, { backgroundColor: c.card, borderColor: c.hairline }]}>
      <Text tone="slate" size={12} weight="600">
        {label}
      </Text>
      <Text size={18} weight="700" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {note ? (
        <Text tone="slate" size={11}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  stat: { flexBasis: '48%', flexGrow: 1, padding: space.md, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
});
