import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CaretDown, Storefront } from '@/components/icons';
import { Text } from '@/components/ui';
import { radius, space } from '@/lib/theme';
import { useApp } from '@/providers/app-provider';

/** The store being worked in; tap to switch. Hidden when there is only one store. */
export function StorePill({ onDark = false }: { onDark?: boolean }) {
  const { c, t, store, stores, allStores } = useApp();
  if (stores.length < 2 || (!store && !allStores)) return null;
  const fg = onDark ? '#FFFFFF' : c.ink;
  return (
    <Pressable
      onPress={() => router.push('/stores')}
      hitSlop={6}
      style={({ pressed }) => [
        styles.pill,
        onDark
          ? { backgroundColor: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.16)' }
          : { backgroundColor: c.card, borderColor: c.hairline },
        pressed && { opacity: 0.7 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${t.store}: ${allStores ? t.allStores : store?.name}`}>
      <Storefront size={15} color={allStores ? c.amber : c.brand} weight="fill" />
      <Text size={13} weight="600" numberOfLines={1} style={{ color: fg, maxWidth: 170 }}>
        {allStores ? t.allStores : store?.name}
      </Text>
      <CaretDown size={12} color={fg} weight="bold" />
    </Pressable>
  );
}

/** Large title for tab screens, with the store switcher. */
export function ScreenHeader({ title, right }: { title: string; right?: ReactNode }) {
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + space.md, backgroundColor: c.bg }]}>
      <View style={styles.row}>
        <Text size={30} weight="700" style={{ flex: 1, letterSpacing: -0.5 }} numberOfLines={1}>
          {title}
        </Text>
        {right}
      </View>
      <View style={{ marginTop: space.sm, alignItems: 'flex-start' }}>
        <StorePill />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.lg, paddingBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
