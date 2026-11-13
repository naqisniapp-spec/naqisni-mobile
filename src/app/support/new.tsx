import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput } from 'react-native';

import { Button, Text } from '@/components/ui';
import { MAX_MESSAGE_LENGTH, openTicket } from '@/lib/support';
import { radius, space } from '@/lib/theme';
import { useApp } from '@/providers/app-provider';
import { gated } from '@/components/app-gate';

/** Open a ticket — one per problem, like on naqisni.com. */
function NewTicketScreen() {
  const { c, t } = useApp();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (title.trim().length < 3 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const id = await openTicket(title.trim(), body.trim());
      router.replace({ pathname: '/support/[id]', params: { id } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setError(msg === 'not_opened' || !msg ? t.notOpened : msg);
      setBusy(false);
    }
  }

  const input = [styles.input, { backgroundColor: c.card, borderColor: c.hairline, color: c.ink }];

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }} keyboardShouldPersistTaps="handled">
      <Text tone="slate" size={13} weight="600">
        {t.ticketTitle}
      </Text>
      <TextInput
        style={input}
        value={title}
        onChangeText={setTitle}
        placeholder={t.ticketTitleHint}
        placeholderTextColor={c.slate}
        maxLength={200}
        autoFocus
      />
      <Text tone="slate" size={13} weight="600" style={{ marginTop: space.sm }}>
        {t.ticketBody}
      </Text>
      <TextInput
        style={[input, { minHeight: 140, paddingTop: space.md, textAlignVertical: 'top' }]}
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={MAX_MESSAGE_LENGTH}
      />
      {error && <Text tone="alert">{error}</Text>}
      <Button title={busy ? t.opening : t.openTicket} onPress={submit} loading={busy} disabled={title.trim().length < 3} style={{ marginTop: space.sm }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 50, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.lg, fontSize: 16 },
});

export default gated('support', NewTicketScreen);
