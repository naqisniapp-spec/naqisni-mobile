import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BusinessGate } from '@/components/business-gate';
import { ErrorState, Loading, Text } from '@/components/ui';
import type { Business } from '@/lib/data';
import {
  loadMessages,
  loadTicket,
  markRead,
  MAX_MESSAGE_LENGTH,
  sendMessage,
  setTicketStatus,
  shortWhen,
  watchMessages,
  type Message,
  type Ticket,
} from '@/lib/support';
import { radius, space } from '@/lib/theme';
import { useApp } from '@/providers/app-provider';

/** One chat: a ticket's, or the General chat (id = "general"). Updates live. */
export default function ChatScreen() {
  return <BusinessGate>{(b) => <Chat business={b} />}</BusinessGate>;
}

function Chat({ business }: { business: Business }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ticketId = id === 'general' ? null : id;
  const { c, t, lang } = useApp();
  const insets = useSafeAreaInsets();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [pictures, setPictures] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  const add = useCallback((m: Message) => setMessages((prev) => (prev?.some((x) => x.id === m.id) ? prev : [...(prev ?? []), m])), []);

  const load = useCallback(async () => {
    try {
      const [tk, res] = await Promise.all([ticketId ? loadTicket(ticketId) : Promise.resolve(null), loadMessages(business.id, ticketId)]);
      setTicket(tk);
      setMessages(res.messages);
      setPictures(res.pictures);
      setError(null);
      markRead(ticketId).catch(() => undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [business.id, ticketId]);

  useEffect(() => {
    // Fetches first; state is only set once the request returns.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    return watchMessages(business.id, ticketId, (m) => {
      add(m);
      if (m.sender === 'admin') markRead(ticketId).catch(() => undefined);
      if (m.attachment_path) load();
    });
  }, [business.id, ticketId, load, add]);

  async function send() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setNote(null);
    try {
      add(await sendMessage(business.id, ticketId, text));
      setBody('');
    } catch (e) {
      setNote(e instanceof Error && e.message === 'too_many' ? t.tooMany : t.notSent);
    } finally {
      setSending(false);
    }
  }

  async function toggleStatus() {
    if (!ticket) return;
    const next = ticket.status === 'open' ? 'closed' : 'open';
    try {
      await setTicketStatus(ticket.id, next);
      setTicket({ ...ticket, status: next });
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    }
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!messages) return <Loading />;
  const closed = ticket?.status === 'closed';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen
        options={{
          title: ticketId ? (ticket?.title ?? '') : t.generalChat,
          headerRight: ticket
            ? () => (
                <Pressable onPress={toggleStatus} hitSlop={10}>
                  <Text tone="brand" weight="600" size={14}>
                    {closed ? t.reopen : t.markSolved}
                  </Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: space.lg, gap: space.sm, flexGrow: 1 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <Text tone="slate" style={{ textAlign: 'center', marginTop: space.xxl }}>
            {t.noMessages}
          </Text>
        }
        renderItem={({ item: m }) => {
          const mine = m.sender === 'customer';
          return (
            <View style={[styles.bubbleWrap, { alignItems: mine ? 'flex-end' : 'flex-start' }]}>
              <View style={[styles.bubble, { backgroundColor: mine ? c.brandSoft : c.card, borderColor: mine ? c.brand : c.hairline }]}>
                {!mine && (
                  <Text tone="brand" size={12} weight="700">
                    {t.naqisni}
                  </Text>
                )}
                {m.attachment_path && pictures[m.attachment_path] ? (
                  <Image source={pictures[m.attachment_path]} style={styles.picture} contentFit="cover" />
                ) : null}
                {m.body ? <Text>{m.body}</Text> : !m.attachment_path ? null : !pictures[m.attachment_path] ? <Text tone="slate">{t.picture}</Text> : null}
                <Text tone="slate" size={11} style={{ alignSelf: 'flex-end' }}>
                  {shortWhen(m.created_at, lang)}
                  {m.channel === 'whatsapp' ? ' · WhatsApp' : ''}
                </Text>
              </View>
            </View>
          );
        }}
      />
      {closed ? (
        <View style={[styles.closed, { borderTopColor: c.hairline, paddingBottom: insets.bottom + space.md }]}>
          <Text tone="slate" style={{ textAlign: 'center' }}>
            {t.ticketClosed}
          </Text>
        </View>
      ) : (
        <View style={[styles.composer, { borderTopColor: c.hairline, backgroundColor: c.bg, paddingBottom: insets.bottom + space.sm }]}>
          {note && (
            <Text tone="alert" size={13} style={{ marginBottom: space.sm }}>
              {note}
            </Text>
          )}
          <View style={styles.composerRow}>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder={t.typeMessage}
              placeholderTextColor={c.slate}
              multiline
              maxLength={MAX_MESSAGE_LENGTH}
              style={[styles.input, { backgroundColor: c.card, borderColor: c.hairline, color: c.ink }]}
            />
            <Pressable
              onPress={send}
              disabled={!body.trim() || sending}
              style={({ pressed }) => [styles.send, { backgroundColor: c.brand, opacity: !body.trim() || sending ? 0.5 : pressed ? 0.8 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel={t.send}>
              <Text weight="700" style={{ color: c.onBrand }}>
                {t.send}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bubbleWrap: { width: '100%' },
  bubble: { maxWidth: '85%', borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.md, paddingVertical: space.sm, gap: 4 },
  picture: { width: 220, height: 220, borderRadius: radius.md },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.md, paddingTop: space.sm },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  input: { flex: 1, minHeight: 44, maxHeight: 140, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: space.md, paddingTop: 11, paddingBottom: 11, fontSize: 16 },
  send: { height: 44, paddingHorizontal: space.lg, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  closed: { borderTopWidth: StyleSheet.hairlineWidth, padding: space.lg },
});
