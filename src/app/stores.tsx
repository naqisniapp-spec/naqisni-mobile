import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { ALL_STORES } from '@/lib/supabase';
import { radius, space } from '@/lib/theme';
import { useApp } from '@/providers/app-provider';

/** Store picker. "All stores" shows every branch this person can use, together. */
export default function StoresScreen() {
  const { c, t, stores, store, allStores, setStore } = useApp();
  const options = [
    ...(stores.length > 1 ? [{ id: ALL_STORES, name: t.allStores, sub: t.allStoresHint, on: allStores }] : []),
    ...stores.map((s) => ({ id: s.id, name: s.name, sub: s.city, on: s.id === store?.id })),
  ];
  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.sm }}>
      {options.map((o) => (
        <Pressable
          key={o.id}
          onPress={() => {
            setStore(o.id);
            router.back();
          }}
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: o.on ? c.brandSoft : c.card, borderColor: o.on ? c.brand : c.hairline, opacity: pressed ? 0.75 : 1 },
            o.id === ALL_STORES && { marginBottom: space.sm },
          ]}>
          <View style={{ flex: 1 }}>
            <Text weight={o.id === ALL_STORES ? '700' : '600'}>{o.name}</Text>
            {o.sub ? (
              <Text tone="slate" size={13}>
                {o.sub}
              </Text>
            ) : null}
          </View>
          {o.on && (
            <Text tone="brand" weight="800">
              ✓
            </Text>
          )}
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: space.lg, borderRadius: radius.lg, borderWidth: 1 },
});
