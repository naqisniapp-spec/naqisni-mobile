import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput } from 'react-native';

import { Button, Card, fontFor, Loading, panel, Text } from '@/components/ui';
import { supabase, webApi } from '@/lib/supabase';
import { radius, space } from '@/lib/theme';
import { useApp } from '@/providers/app-provider';

/**
 * Account deletion request — the same flow as naqisni.com's Account page
 * (POST/DELETE /api/account/delete-request, migration 0047). Required by
 * Google Play and the App Store. The admin deletes the account afterwards.
 */
export default function DeleteAccountScreen() {
  const { c, t, lang, session } = useApp();
  const [pending, setPending] = useState<boolean | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    const { data } = await supabase
      .from('account_deletion_requests')
      .select('id')
      .eq('user_id', session?.user.id ?? '')
      .eq('status', 'pending')
      .limit(1);
    setPending(Boolean(data?.length));
  }, [session?.user.id]);

  useEffect(() => {
    // Reads first; state is only set once the request returns.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    check();
  }, [check]);

  async function send() {
    if (reason.trim().length < 3) return setError(t.deleteNeedReason);
    setBusy(true);
    setError(null);
    try {
      await webApi('/api/account/delete-request', { reason: reason.trim() });
      setPending(true);
      setReason('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    setBusy(true);
    setError(null);
    try {
      await webApi('/api/account/delete-request', undefined, 'DELETE');
      setPending(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (pending === null) return <Loading />;

  return (
    <ScrollView contentContainerStyle={[panel(c), { gap: space.lg }]} keyboardShouldPersistTaps="handled">
      <Text tone="slate">{t.deleteIntro}</Text>
      {pending ? (
        <>
          <Card style={{ backgroundColor: c.amberSoft, borderColor: c.amber }}>
            <Text weight="600">{t.deletePending}</Text>
          </Card>
          <Button title={t.deleteWithdraw} variant="secondary" onPress={withdraw} loading={busy} />
        </>
      ) : (
        <>
          <Text tone="slate" size={13} weight="600">
            {t.deleteReason}
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            multiline
            maxLength={1000}
            style={[styles.input, fontFor('400', lang), { backgroundColor: c.card, borderColor: c.hairline, color: c.ink }]}
          />
          <Button title={busy ? t.deleteSending : t.deleteSend} variant="danger" onPress={send} loading={busy} />
        </>
      )}
      {error && <Text tone="alert">{error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 120, borderWidth: 1, borderRadius: radius.md, padding: space.md, fontSize: 16, textAlignVertical: 'top' },
});
