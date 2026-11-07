import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput } from 'react-native';

import { Button, Segmented, Text } from '@/components/ui';
import { recordMovement, type MovementType } from '@/lib/data';
import { qty } from '@/lib/stock';
import { radius, space } from '@/lib/theme';
import { useApp } from '@/providers/app-provider';

/** Record a sale, restock, return or adjustment — same rules as the website. */
export default function RecordScreen() {
  const { productId, name, unit } = useLocalSearchParams<{ productId: string; name?: string; unit?: string }>();
  const { c, t, business } = useApp();
  const [type, setType] = useState<MovementType>('sale');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'alert' | 'brand'; text: string } | null>(null);

  async function save() {
    const raw = Number(amount.replace(',', '.'));
    if (!amount.trim() || Number.isNaN(raw) || raw === 0) return setMessage({ tone: 'alert', text: t.enterQuantity });
    if (!business) return;
    setBusy(true);
    setMessage(null);
    try {
      const next = await recordMovement(business.id, productId, type, raw, note.trim());
      setMessage({ tone: 'brand', text: t.recorded(`${qty(next)}${unit ? ` ${unit}` : ''}`) });
      setAmount('');
      setNote('');
      setTimeout(() => router.back(), 700);
    } catch (e) {
      const err = e as Error & { current?: number };
      setMessage({ tone: 'alert', text: err.message === 'not_enough' ? t.notEnough(qty(err.current ?? 0)) : err.message });
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
      <Segmented
        value={type}
        onChange={setType}
        options={[
          { value: 'sale', label: t.sale },
          { value: 'restock', label: t.restock },
          { value: 'return', label: t.return },
          { value: 'adjustment', label: t.adjustment },
        ]}
      />
      <Text tone="slate" size={13} weight="600" style={{ marginTop: space.sm }}>
        {t.quantity}
        {unit ? ` (${unit})` : ''}
      </Text>
      <TextInput
        style={[input, { fontSize: 28, fontWeight: '700' }]}
        value={amount}
        onChangeText={setAmount}
        keyboardType={type === 'adjustment' ? 'numbers-and-punctuation' : 'decimal-pad'}
        autoFocus
        placeholder="0"
        placeholderTextColor={c.slate}
      />
      {type === 'adjustment' && (
        <Text tone="slate" size={13}>
          {t.adjustHint}
        </Text>
      )}
      <TextInput style={input} value={note} onChangeText={setNote} placeholder={t.note} placeholderTextColor={c.slate} maxLength={300} />
      {message && <Text tone={message.tone}>{message.text}</Text>}
      <Button title={busy ? t.saving : t.save} onPress={save} loading={busy} style={{ marginTop: space.sm }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 52, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.lg, fontSize: 16 },
});
