import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { radius, space } from '@/lib/theme';
import { useApp } from '@/providers/app-provider';

/** Large title for tab screens, with the store switcher when there is more than one store. */
export function ScreenHeader({ title, right }: { title: string; right?: ReactNode }) {
  const { c, store, stores } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + space.md, backgroundColor: c.bg }]}>
      <View style={styles.row}>
        <Text size={30} weight="800" style={{ flex: 1, letterSpacing: -0.4 }} numberOfLines={1}>
          {title}
        </Text>
        {right}
      </View>
      {stores.length > 1 && store && (
        <Pressable
          onPress={() => router.push('/stores')}
          style={({ pressed }) => [styles.store, { backgroundColor: c.card, borderColor: c.hairline, opacity: pressed ? 0.7 : 1 }]}
          accessibilityRole="button">
          <View style={[styles.dot, { backgroundColor: c.brand }]} />
          <Text size={13} weight="600" numberOfLines={1}>
            {store.name}
          </Text>
          <Text size={11} tone="slate">
            ▾
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.lg, paddingBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  store: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
