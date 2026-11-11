import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Megaphone } from '@/components/icons';
import { Button, Card, ErrorState, Loading, panel, Text } from '@/components/ui';
import { loadInbox, markInboxRead, messageBody, messageTarget, messageTitle } from '@/lib/inbox';
import { space } from '@/lib/theme';
import { useLoad } from '@/lib/use-load';
import { useApp } from '@/providers/app-provider';

/** One message from Naqisni. Opening it marks it as read. */
export default function InboxMessageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, t, lang, business } = useApp();
  const { data, error, loading, refresh } = useLoad(async () => (await loadInbox()).find((m) => m.id === id) ?? null, `${business?.id}:${id}`);

  const unread = data && !data.read;
  useEffect(() => {
    if (unread) markInboxRead([data.id]).catch(() => undefined);
  }, [unread, data]);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;
  if (!data)
    return (
      <View style={[panel(c), { alignItems: 'center', gap: space.lg }]}>
        <Text tone="slate" style={{ textAlign: 'center' }}>
          {t.inboxGone}
        </Text>
        <Button title={t.inbox} variant="secondary" onPress={() => router.replace('/inbox')} />
      </View>
    );

  const target = messageTarget(data);
  const pageName =
    data.open_url === '/alerts'
      ? t.tabAlerts
      : data.open_url === '/products'
        ? t.tabProducts
        : data.open_url === '/orders'
          ? t.tabOrders
          : data.open_url === '/support'
            ? t.support
            : data.open_url === '/more'
              ? t.tabMore
              : null;
  const ar = lang === 'ar' && Boolean(data.title_ar || data.body_ar);

  return (
    <ScrollView contentContainerStyle={[panel(c), { gap: space.lg, marginBottom: space.xxl * 2 }]}>
      <View style={styles.from}>
        <View style={[styles.icon, { backgroundColor: c.brandSoft }]}>
          <Megaphone size={22} color={c.brandDeep} weight="duotone" />
        </View>
        <View style={{ flex: 1 }}>
          <Text weight="700">{t.inboxFrom}</Text>
          <Text tone="slate" size={13}>
            {new Date(data.created_at).toLocaleString(lang === 'ar' ? 'ar' : 'en-GB', {
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>

      <Card style={{ gap: space.md }}>
        <Text size={20} weight="700" style={ar ? styles.rtl : undefined}>
          {messageTitle(data, lang)}
        </Text>
        <Text size={16} style={[{ lineHeight: 24 }, ar && styles.rtl]}>
          {messageBody(data, lang)}
        </Text>
      </Card>

      {target && pageName && <Button title={t.inboxGoTo(pageName)} onPress={() => router.push(target)} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  from: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rtl: { writingDirection: 'rtl' },
});
