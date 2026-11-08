import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { recordMovement, type MovementType } from '@/lib/data';
import { qty } from '@/lib/stock';
import { recordWaste, transferStock, WASTE_REASONS, type WasteReason } from '@/lib/stock-tools';
import { radius, space } from '@/lib/theme';
import { useApp } from '@/providers/app-provider';

type Kind = MovementType | 'waste' | 'transfer';

/**
 * Record a sale, restock, return or adjustment, take out waste, or move stock
 * to another store — the same rules as the website.
 */
export default function RecordScreen() {
  const { productId, name, unit, source, stock } = useLocalSearchParams<{
    productId: string;
    name?: string;
    unit?: string;
    source?: string;
    stock?: string;
  }>();
  const { c, t, business, store, stores } = useApp();
  const [kind, setKind] = useState<Kind>('sale');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState<WasteReason>('damaged');
  const [toStore, setToStore] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'alert' | 'brand'; text: string } | null>(null);

  // Waste and transfers are for products added in Naqisni (a connected system owns the others' stock).
  const manual = !source || source === 'manual';
  // A transfer leaves from the store being worked in, so one store must be picked.
  const otherStores = store ? stores.filter((s) => s.id !== store.id) : [];
  const kinds: { value: Kind; label: string }[] = [
    { value: 'sale', label: t.sale },
    { value: 'restock', label: t.restock },
    { value: 'return', label: t.return },
    { value: 'adjustment', label: t.adjustment },
    ...(manual ? [{ value: 'waste' as Kind, label: t.waste }] : []),
    ...(manual && stores.length > 1 ? [{ value: 'transfer' as Kind, label: t.transfer }] : []),
  ];
  const u = unit ? ` ${unit}` : '';

  function pick(k: Kind) {
    setKind(k);
    setMessage(null);
  }

  async function save() {
    const raw = Number(amount.replace(',', '.'));
    if (!amount.trim() || Number.isNaN(raw) || raw === 0) return setMessage({ tone: 'alert', text: t.enterQuantity });
    if ((kind === 'waste' || kind === 'transfer') && raw < 0) return setMessage({ tone: 'alert', text: t.enterQuantity });
    if (kind === 'transfer' && !store) return setMessage({ tone: 'alert', text: t.pickStoreFirst });
    if (kind === 'transfer' && !toStore) return setMessage({ tone: 'alert', text: t.chooseReceivingStore });
    if (!business) return;
    setBusy(true);
    setMessage(null);
    try {
      let text: string;
      if (kind === 'waste') {
        await recordWaste(productId, raw, reason, note.trim());
        text = t.wasteRecorded(`${qty(raw)}${u}`);
      } else if (kind === 'transfer') {
        await transferStock(productId, toStore!, raw, note.trim());
        text = t.transferred(`${qty(raw)}${u}`, stores.find((s) => s.id === toStore)?.name ?? '');
      } else {
        const next = await recordMovement(business.id, productId, kind, raw, note.trim());
        text = t.recorded(`${qty(next)}${u}`);
      }
      setMessage({ tone: 'brand', text });
      setAmount('');
      setNote('');
      setTimeout(() => router.back(), 900);
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
        <View style={{ gap: 2 }}>
          <Text size={18} weight="700">
            {name}
          </Text>
          {stock ? (
            <Text tone="slate" size={13}>
              {t.stock}: {qty(Number(stock))}
              {u}
              {store && stores.length > 1 ? ` · ${store.name}` : ''}
            </Text>
          ) : null}
        </View>
      ) : null}

      <Pills value={kind} options={kinds} onChange={pick} />

      {kind === 'waste' && (
        <>
          <Text tone="slate" size={13} weight="600">
            {t.wasteWhy}
          </Text>
          <Pills value={reason} options={WASTE_REASONS.map((r) => ({ value: r, label: t.wasteReasons[r] }))} onChange={setReason} />
        </>
      )}

      {kind === 'transfer' &&
        (store ? (
          <>
            <Text tone="slate" size={13} weight="600">
              {t.sendTo}
            </Text>
            <Pills value={toStore ?? ''} options={otherStores.map((s) => ({ value: s.id, label: s.name }))} onChange={setToStore} />
          </>
        ) : (
          <Text tone="amber">{t.pickStoreFirst}</Text>
        ))}

      <Text tone="slate" size={13} weight="600" style={{ marginTop: space.sm }}>
        {t.quantity}
        {unit ? ` (${unit})` : ''}
      </Text>
      <TextInput
        style={[input, { fontSize: 28, fontWeight: '700' }]}
        value={amount}
        onChangeText={setAmount}
        keyboardType={kind === 'adjustment' ? 'numbers-and-punctuation' : 'decimal-pad'}
        autoFocus
        placeholder="0"
        placeholderTextColor={c.slate}
      />
      {kind === 'adjustment' && (
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

function Pills<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const { c } = useApp();
  return (
    <View style={styles.pills}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[styles.pill, { backgroundColor: on ? c.ink : c.card, borderColor: on ? c.ink : c.hairline }]}>
            <Text size={14} weight="600" style={{ color: on ? c.card : c.ink }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 52, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.lg, fontSize: 16 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
});
