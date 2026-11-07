import { Image } from 'expo-image';
import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CaretRight } from '@/components/icons';
import { riskColors, RiskChip, Text } from '@/components/ui';
import type { ProductRow } from '@/lib/data';
import { qty } from '@/lib/stock';
import { radius, space } from '@/lib/theme';
import { useApp } from '@/providers/app-provider';

/**
 * How full the shelf is, for the little bar: 100% at twice the reorder point
 * (or always full when no reorder point is set and stock is above zero).
 */
function fill(p: ProductRow) {
  if (p.current_stock <= 0) return 0;
  if (!p.reorder_point) return p.risk === 'unset' ? 0.5 : 1;
  return Math.max(0.04, Math.min(1, p.current_stock / (p.reorder_point * 2)));
}

export const ProductItem = memo(function ProductItem({ p }: { p: ProductRow }) {
  const { c, t, rtl, allStores, storeName } = useApp();
  const branch = allStores ? storeName(p.store_id) : null;
  const tone = riskColors(p.risk, c);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/product/[id]', params: { id: p.product_id } })}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.hairline : c.card, borderColor: c.hairline }]}
      accessibilityRole="button">
      {p.image_url ? (
        <Image source={p.image_url} style={styles.thumb} contentFit="cover" transition={150} />
      ) : (
        <View style={[styles.thumb, { backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }]}>
          <Text weight="700" size={18} style={{ color: tone.fg }}>
            {p.name.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={{ flex: 1, gap: 5 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Text weight="600" numberOfLines={1} style={{ flex: 1 }}>
            {p.name}
          </Text>
          <RiskChip risk={p.risk} />
        </View>
        {branch ? (
          <Text tone="slate" size={12} weight="500" numberOfLines={1}>
            {branch}
          </Text>
        ) : null}
        <View style={[styles.track, { backgroundColor: c.hairline }]}>
          <View style={[styles.bar, { width: `${fill(p) * 100}%`, backgroundColor: tone.fg }]} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
          <Text tone="slate" size={12} numberOfLines={1}>
            {t.stock}: <Text size={12} weight="600">{qty(p.current_stock)}</Text>
            {p.unit ? ` ${p.unit}` : ''}
          </Text>
          {p.days !== null && (
            <Text size={12} weight="600" style={{ color: p.risk === 'critical' || p.risk === 'warning' ? tone.fg : c.slate }} numberOfLines={1}>
              {t.daysLeft(p.days)}
            </Text>
          )}
        </View>
      </View>
      <CaretRight size={16} color={c.slate} style={rtl ? { transform: [{ scaleX: -1 }] } : undefined} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: space.sm,
  },
  thumb: { width: 54, height: 54, borderRadius: radius.md },
  track: { height: 5, borderRadius: 3, overflow: 'hidden' },
  bar: { height: 5, borderRadius: 3 },
});
