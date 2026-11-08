import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Sparkle } from '@/components/icons';
import { Button, Row, Text } from '@/components/ui';
import { aiEnabled, productInsight, type Insight } from '@/lib/ai';
import { radius, space } from '@/lib/theme';
import { useApp } from '@/providers/app-provider';

/** "Naqisni explains" on the product page — only when AI is switched on for the business. */
export function AiInsightCard({ businessId, productId }: { businessId: string; productId: string }) {
  const { c, t, lang } = useApp();
  const [on, setOn] = useState(false);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    aiEnabled(businessId).then((v) => live && setOn(v));
    return () => {
      live = false;
    };
  }, [businessId]);

  if (!on) return null;

  async function ask(refresh: boolean) {
    setBusy(true);
    setError(null);
    try {
      setInsight(await productInsight(productId, lang, refresh));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  const when = insight
    ? new Date(insight.createdAt).toLocaleString(lang === 'ar' ? 'ar' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <View style={[styles.card, { backgroundColor: c.brandSoft, borderColor: c.brand }]}>
      <Row style={{ gap: space.sm }}>
        <Sparkle size={18} color={c.brandDeep} weight="fill" />
        <Text weight="700" style={{ flex: 1 }}>
          {t.aiExplains}
        </Text>
        <View style={[styles.badge, { backgroundColor: c.card }]}>
          <Text size={11} weight="700" tone="brand">
            AI
          </Text>
        </View>
      </Row>
      {insight ? (
        <>
          <Text style={{ lineHeight: 22 }}>{insight.body}</Text>
          <Text tone="slate" size={12}>
            {t.aiWrittenAt(when)}
          </Text>
          {busy ? (
            <ActivityIndicator color={c.brandDeep} />
          ) : (
            <Text tone="brand" weight="600" onPress={() => ask(true)}>
              {t.aiExplainAgain}
            </Text>
          )}
        </>
      ) : (
        <>
          <Text tone="slate" size={14}>
            {t.aiIntro}
          </Text>
          <Button title={busy ? t.aiThinking : t.aiExplainProduct} onPress={() => ask(false)} loading={busy} />
        </>
      )}
      {error ? <Text tone="alert">{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
});
