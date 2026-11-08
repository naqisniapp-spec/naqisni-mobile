import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Sparkle } from '@/components/icons';
import { Text } from '@/components/ui';
import { aiEnabled } from '@/lib/ai';
import { palette, radius, space } from '@/lib/theme';
import { useApp } from '@/providers/app-provider';

const NAVY = '#10182B';

/**
 * The Naqisni AI assistant bar on the Overview (on the dark header), only when
 * AI is switched on. It is styled to read clearly as an AI assistant, the
 * same as the website. Tapping it opens the Ask screen.
 */
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
        accessibilityLabel={t.askAssistant}
        accessibilityHint={t.askBarHint}
        style={({ pressed }) => [styles.bar, pressed && { opacity: 0.9 }]}>
        <View style={styles.icon}>
          <Sparkle size={22} color={palette.light.brand} weight="fill" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text size={13} weight="700" style={{ color: NAVY }} numberOfLines={1}>
              {t.askAssistant}
            </Text>
            <View style={styles.ai}>
              <Text size={10} weight="700" style={{ color: NAVY }}>
                AI
              </Text>
            </View>
          </View>
          <Text size={14} style={{ color: '#5B6472' }} numberOfLines={1}>
            {t.askBarHint}
          </Text>
        </View>
        <View style={styles.button}>
          <Sparkle size={14} color={NAVY} weight="fill" />
          <Text size={13} weight="700" style={{ color: NAVY }}>
            {t.askSend}
          </Text>
        </View>
      </Pressable>
      <Text size={12} style={{ color: 'rgba(255,255,255,0.65)' }}>
        {t.askTry}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {t.askSuggestions.map((s) => (
          <Pressable key={s} onPress={() => open(s)} style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}>
            <Text size={13} style={{ color: 'rgba(255,255,255,0.9)' }}>
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
    gap: space.md,
    minHeight: 64,
    padding: space.sm,
    borderRadius: radius.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: palette.light.brand,
    shadowColor: palette.light.brand,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  icon: { width: 44, height: 44, borderRadius: 12, backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center' },
  ai: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.pill, backgroundColor: palette.light.brand },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: palette.light.brand,
  },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
});
