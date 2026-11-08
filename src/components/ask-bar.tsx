import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Sparkle } from '@/components/icons';
import { Text } from '@/components/ui';
import { aiEnabled } from '@/lib/ai';
import { palette, radius, space } from '@/lib/theme';
import { useApp } from '@/providers/app-provider';

/** "Ask Naqisni" at the top of the Overview (on the dark header) — only when AI is switched on. */
export function AskBar({ businessId }: { businessId: string }) {
  const { t } = useApp();
  const [on, setOn] = useState(false);

  useEffect(() => {
    let live = true;
    aiEnabled(businessId).then((v) => live && setOn(v));
    return () => {
      live = false;
    };
  }, [businessId]);

  if (!on) return null;
  const open = (q?: string) => router.push(q ? { pathname: '/ask', params: { q } } : '/ask');

  return (
    <View style={{ marginTop: space.lg, gap: space.sm }}>
      <Pressable
        onPress={() => open()}
        accessibilityRole="button"
        accessibilityLabel={t.askNaqisni}
        style={({ pressed }) => [styles.bar, pressed && { opacity: 0.85 }]}>
        <Sparkle size={20} color={palette.light.brand} weight="fill" />
        <Text style={{ color: 'rgba(255,255,255,0.7)', flex: 1 }} numberOfLines={1}>
          {t.askPlaceholder}
        </Text>
        <View style={styles.ai}>
          <Text size={11} weight="700" style={{ color: palette.light.brand }}>
            AI
          </Text>
        </View>
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {t.askSuggestions.map((s) => (
          <Pressable key={s} onPress={() => open(s)} style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}>
            <Text size={13} style={{ color: 'rgba(255,255,255,0.85)' }}>
              {s}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  ai: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.10)' },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
});
