import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Linking, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { BusinessGate } from '@/components/business-gate';
import { Button, Card, ErrorState, Loading, RiskChip, Row, Text } from '@/components/ui';
import { loadProduct, type Business } from '@/lib/data';
import { qty } from '@/lib/stock';
import { radius, space } from '@/lib/theme';
import { useLoad } from '@/lib/use-load';
import { useApp } from '@/providers/app-provider';

export default function ProductScreen() {
  return <BusinessGate>{(b) => <Product business={b} />}</BusinessGate>;
}

function Product({ business }: { business: Business }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, t, lang, scopeKey, storeName } = useApp();
  const { data, error, loading, refreshing, refresh } = useLoad(() => loadProduct(business.id, id), `${scopeKey}:${id}`);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? t.noProducts} onRetry={refresh} />;
  const p = data.product;
  const unit = p.unit ? ` ${p.unit}` : '';
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const typeLabel: Record<string, string> = { sale: t.sale, restock: t.restock, return: t.return, adjustment: t.adjustment };

  const details: [string, string | null][] = [
    [t.brand, p.brand],
    [t.category, p.category],
    [t.store, storeName(p.store_id)],
    [t.location, p.location],
    ['SKU', p.sku],
    ['Barcode', p.barcode],
    [t.price, p.sell_price != null ? `${p.sell_price} ${p.currency ?? business.currency ?? ''}`.trim() : null],
  ];

  return (
    <>
      <Stack.Screen options={{ title: p.name }} />
      <ScrollView
        contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.brandDeep} />}>
        <Row style={{ gap: space.lg, alignItems: 'flex-start' }}>
          {p.image_url ? <Image source={p.image_url} style={styles.photo} contentFit="cover" transition={200} /> : null}
          <View style={{ flex: 1, gap: space.sm }}>
            <Text size={22} weight="800">
              {p.name}
            </Text>
            <RiskChip risk={p.risk} />
          </View>
        </Row>

        <View style={styles.stats}>
          <Stat label={t.stock} value={`${qty(p.current_stock)}${unit}`} />
          <Stat label={t.forecast} value={p.days === null ? '—' : t.daysLeft(p.days)} />
          <Stat label={t.reorderPoint} value={p.reorder_point === null ? '—' : `${qty(p.reorder_point)}${unit}`} />
          <Stat label={t.onOrder} value={p.onOrder ? `${qty(p.onOrder)}${unit}` : '—'} />
        </View>

        {(p.reorderQty || p.orderBy) && (
          <Card style={{ backgroundColor: c.brandSoft, borderColor: c.brand, gap: 4 }}>
            {p.reorderQty ? (
              <Text weight="600">
                {t.suggestedOrder}: {qty(p.reorderQty)}
                {unit}
              </Text>
            ) : null}
            {p.orderBy ? (
              <Text tone="slate">
                {t.orderBy}:{' '}
                {new Date(p.orderBy + 'T00:00:00Z').toLocaleDateString(lang === 'ar' ? 'ar' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}
              </Text>
            ) : null}
          </Card>
        )}

        {p.supplier_name && (
          <Card style={{ gap: 4 }}>
            <Text tone="slate" size={13}>
              {t.supplier}
            </Text>
            <Text weight="600">{p.supplier_name}</Text>
            {p.supplier_phone && (
              <Text tone="brand" weight="600" onPress={() => Linking.openURL(`tel:${p.supplier_phone}`)}>
                {p.supplier_phone}
              </Text>
            )}
          </Card>
        )}

        {details.some(([, v]) => v) && (
          <Card style={{ paddingVertical: space.sm }}>
            {details
              .filter(([, v]) => v)
              .map(([k, v], i) => (
                <Row key={k} style={[styles.detail, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline }]}>
                  <Text tone="slate" style={{ flex: 1 }}>
                    {k}
                  </Text>
                  <Text weight="500">{v}</Text>
                </Row>
              ))}
          </Card>
        )}

        {data.movements.length > 0 && (
          <Card style={{ paddingVertical: space.sm }}>
            {data.movements.map((m, i) => (
              <Row key={m.id} style={[styles.detail, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline }]}>
                <View style={{ flex: 1 }}>
                  <Text weight="500">{typeLabel[m.type] ?? m.type}</Text>
                  <Text tone="slate" size={12}>
                    {date(m.occurred_at)}
                  </Text>
                </View>
                <Text weight="700" style={{ color: Number(m.quantity) < 0 ? c.alert : c.brandDeep }}>
                  {Number(m.quantity) > 0 ? '+' : ''}
                  {qty(m.quantity)}
                </Text>
              </Row>
            ))}
          </Card>
        )}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: c.bg, borderTopColor: c.hairline }]}>
        <Button title={t.recordChange} onPress={() => router.push({ pathname: '/record', params: { productId: p.product_id, name: p.name, unit: p.unit ?? '' } })} />
      </View>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { c } = useApp();
  return (
    <View style={[styles.stat, { backgroundColor: c.card, borderColor: c.hairline }]}>
      <Text tone="slate" size={12} weight="600">
        {label}
      </Text>
      <Text size={17} weight="700" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { width: 96, height: 96, borderRadius: radius.lg },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  stat: { flexBasis: '48%', flexGrow: 1, padding: space.md, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: 4 },
  detail: { paddingVertical: space.md, gap: space.md },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.lg, paddingBottom: space.xxl, borderTopWidth: StyleSheet.hairlineWidth },
});
