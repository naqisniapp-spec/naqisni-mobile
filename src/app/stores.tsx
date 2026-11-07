import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { radius, space } from '@/lib/theme';
import { useApp } from '@/providers/app-provider';

export default function StoresScreen() {
  const { c, stores, store, setStore } = useApp();
  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.sm }}>
      {stores.map((s) => {
        const on = s.id === store?.id;
        return (
          <Pressable
            key={s.id}
            onPress={() => {
              setStore(s.id);
              router.back();
            }}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: on ? c.brandSoft : c.card, borderColor: on ? c.brand : c.hairline, opacity: pressed ? 0.75 : 1 },
            ]}>
            <View style={{ flex: 1 }}>
              <Text weight="600">{s.name}</Text>
              {s.city ? (
                <Text tone="slate" size={13}>
                  {s.city}
                </Text>
              ) : null}
            </View>
            {on && (
              <Text tone="brand" weight="800">
                ✓
              </Text>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: space.lg, borderRadius: radius.lg, borderWidth: 1 },
});
