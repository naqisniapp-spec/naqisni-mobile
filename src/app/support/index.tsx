import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { BusinessGate } from '@/components/business-gate';
import { Button, Card, ErrorState, Loading, panel, Text } from '@/components/ui';
import type { Business } from '@/lib/data';
import { loadSupport, shortWhen, ticketUnread, type Ticket } from '@/lib/support';
import { radius, space } from '@/lib/theme';
import { useLoad } from '@/lib/use-load';
import { useApp } from '@/providers/app-provider';

export default function SupportScreen() {
  return <BusinessGate>{(b) => <Support business={b} />}</BusinessGate>;
}

function Support({ business }: { business: Business }) {
  const { c, t, lang } = useApp();
  const { data, error, loading, refreshing, refresh } = useLoad(() => loadSupport(business.id), business.id);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? ''} onRetry={refresh} />;
  const open = data.tickets.filter((x) => x.status === 'open');
  const solved = data.tickets.filter((x) => x.status === 'closed');

  return (
    <ScrollView
      contentContainerStyle={[panel(c), { gap: space.lg, marginBottom: space.xxl * 2 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.brandDeep} />}>
      <Text tone="slate">{t.supportIntro}</Text>
      <Button title={t.newTicket} onPress={() => router.push('/support/new')} />

      {open.length > 0 && <TicketList title={`${t.openTickets} (${open.length})`} tickets={open} />}
      {solved.length > 0 && <TicketList title={`${t.solved} (${solved.length})`} tickets={solved} />}

      <Card onPress={() => router.push({ pathname: '/support/[id]', params: { id: 'general' } })}>
        <View style={styles.row}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text weight="600">{t.generalChat}</Text>
            <Text tone="slate" size={13} numberOfLines={2}>
              {data.general
                ? `${data.general.sender === 'admin' ? t.naqisni : t.you}: ${data.general.body || t.picture}`
                : t.generalHint}
            </Text>
          </View>
          {data.generalUnread && <View style={[styles.unread, { backgroundColor: c.brandDeep }]} />}
          {data.general && (
            <Text tone="slate" size={12}>
              {shortWhen(data.general.created_at, lang)}
            </Text>
          )}
        </View>
      </Card>
    </ScrollView>
  );
}

function TicketList({ title, tickets }: { title: string; tickets: Ticket[] }) {
  const { c, t, lang } = useApp();
  return (
    <View style={{ gap: space.sm }}>
      <Text size={16} weight="700">
        {title}
      </Text>
      <View style={[styles.list, { backgroundColor: c.card, borderColor: c.hairline }]}>
        {tickets.map((tk, i) => (
          <Pressable
            key={tk.id}
            onPress={() => router.push({ pathname: '/support/[id]', params: { id: tk.id } })}
            style={({ pressed }) => [
              styles.row,
              styles.item,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline },
              pressed && { backgroundColor: c.hairline },
            ]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text weight={ticketUnread(tk) ? '700' : '600'} numberOfLines={1}>
                {tk.title}
              </Text>
              <Text tone="slate" size={13} numberOfLines={1}>
                {t.ticketNo(tk.number)}
                {tk.last_preview ? ` · ${tk.last_sender === 'admin' ? t.naqisni : t.you}: ${tk.last_preview}` : ''}
              </Text>
            </View>
            {ticketUnread(tk) && <View style={[styles.unread, { backgroundColor: c.brandDeep }]} />}
            <Text tone="slate" size={12}>
              {shortWhen(tk.last_message_at ?? tk.opened_at, lang)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  item: { padding: space.lg },
  list: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  unread: { width: 10, height: 10, borderRadius: 5 },
});
