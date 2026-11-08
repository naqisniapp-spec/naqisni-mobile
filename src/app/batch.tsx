import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Button, Row, Text } from '@/components/ui';
import { addBatch, parseDate } from '@/lib/batches';
import { qty } from '@/lib/stock';
import { radius, space } from '@/lib/theme';
import { useApp } from '@/providers/app-provider';

/** Add a batch with its expiry date (and optionally add it to the stock), like the website's product page. */
export default function BatchScreen() {
  const { productId, name, unit, source } = useLocalSearchParams<{ productId: string; name?: string; unit?: string; source?: string }>();
  const { c, t, business } = useApp();
  const canChangeStock = !source || source === 'manual';
  const [amount, setAmount] = useState('');
  const [expiry, setExpiry] = useState('');
  const [code, setCode] = useState('');
  const [addToStock, setAddToStock] = useState(canChangeStock);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'alert' | 'brand'; text: string } | null>(null);

  async function save() {
    if (!business) return;
    const n = Number(amount.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) return setMessage({ tone: 'alert', text: t.howManyArrived });
    let iso: string | null;
    try {
      iso = parseDate(expiry);
    } catch {
      return setMessage({ tone: 'alert', text: t.badDate });
    }
    setBusy(true);
    setMessage(null);
    try {
      await addBatch({ businessId: business.id, productId, quantity: n, expiry: iso, code, addToStock: canChangeStock && addToStock });
      setMessage({ tone: 'brand', text: addToStock && canChangeStock ? t.batchAddedStock(`${qty(n)}${unit ? ` ${unit}` : ''}`) : t.batchAdded });
      setTimeout(() => router.back(), 800);
    } catch (e) {
      setMessage({ tone: 'alert', text: e instanceof Error ? e.message : t.error });
    } finally {
      setBusy(false);
    }
  }

  const input = [styles.input, { backgroundColor: c.card, borderColor: c.hairline, color: c.ink }];

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }} keyboardShouldPersistTaps="handled">
      {name ? (
        <Text size={18} weight="700">
          {name}
        </Text>
      ) : null}
      <Text tone="slate" size={13} weight="600">
        {t.howMany}
        {unit ? ` (${unit})` : ''}
      </Text>
      <TextInput style={[input, { fontSize: 24, fontWeight: '700' }]} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" autoFocus placeholder="0" placeholderTextColor={c.slate} />
      <Text tone="slate" size={13} weight="600">
        {t.expiryDate}
      </Text>
      <TextInput style={input} value={expiry} onChangeText={setExpiry} keyboardType="numbers-and-punctuation" placeholder="31/12/2026" placeholderTextColor={c.slate} maxLength={10} />
      <Text tone="slate" size={13} weight="600">
        {t.batchCode}
      </Text>
      <TextInput style={input} value={code} onChangeText={setCode} placeholder={t.optional} placeholderTextColor={c.slate} maxLength={60} autoCapitalize="characters" />
      {canChangeStock ? (
        <Row style={{ gap: space.md, marginTop: space.sm }}>
          <View style={{ flex: 1 }}>
            <Text weight="600">{t.addToStock}</Text>
            <Text tone="slate" size={12}>
              {t.addToStockHint}
            </Text>
          </View>
          <Switch value={addToStock} onValueChange={setAddToStock} trackColor={{ true: c.brand, false: c.hairline }} thumbColor="#FFFFFF" />
        </Row>
      ) : null}
      {message ? <Text tone={message.tone}>{message.text}</Text> : null}
      <Button title={busy ? t.saving : t.addBatch} onPress={save} loading={busy} style={{ marginTop: space.sm }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 52, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.lg, fontSize: 16 },
});
