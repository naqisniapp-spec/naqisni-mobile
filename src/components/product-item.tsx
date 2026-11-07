import { Image } from 'expo-image';
import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { RiskChip, Text } from '@/components/ui';
import type { ProductRow } from '@/lib/data';
import { qty } from '@/lib/stock';
import { radius, space } from '@/lib/theme';
import { useApp } from '@/providers/app-provider';

export const ProductItem = memo(function ProductItem({ p }: { p: ProductRow }) {
  const { c, t } = useApp();
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/product/[id]', params: { id: p.product_id } })}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.hairline : c.card, borderColor: c.hairline }]}>
      {p.image_url ? (
        <Image source={p.image_url} style={styles.thumb} contentFit="cover" transition={150} />
      ) : (
        <View style={[styles.thumb, { backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }]}>
          <Text tone="slate" weight="700">
            {p.name.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={{ flex: 1, gap: 4 }}>
        <Text weight="600" numberOfLines={1}>
          {p.name}
        </Text>
        <Text tone="slate" size={13} numberOfLines={1}>
          {t.stock}: {qty(p.current_stock)}
          {p.unit ? ` ${p.unit}` : ''}
          {p.days !== null ? `  ·  ${t.daysLeft(p.days)}` : ''}
        </Text>
        <RiskChip risk={p.risk} />
      </View>
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
  thumb: { width: 52, height: 52, borderRadius: radius.md },
});
