import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { BusinessGate } from '@/components/business-gate';
import { Check, Truck, WhatsappLogo } from '@/components/icons';
import { Button, Card, Empty, ErrorState, Loading, panel, RiskChip, Row, Text } from '@/components/ui';
import type { Business } from '@/lib/data';
import {
  callingCode,
  createOrder,
  localDay,
  markSent,
  orderMessage,
  whatsappLink,
  whatsappNumber,
  loadOrderPlanner,
  type OrderBusiness,
  type SupplierGroup,
} from '@/lib/orders';
import { qty } from '@/lib/stock';
import { radius, space } from '@/lib/theme';
import { useLoad } from '@/lib/use-load';
import { useApp } from '@/providers/app-provider';

const DAY = 86_400_000;

/**
 * Make an order by hand: first pick the supplier (those with products to
 * reorder come first), then tick products, set quantities and the delivery
 * day, and create it — optionally sending it on WhatsApp straight away.
 */
export default function NewOrderScreen() {
  const { supplier } = useLocalSearchParams<{ supplier?: string }>();
  const { t } = useApp();
  return (
    <>
      <Stack.Screen options={{ title: t.newOrder }} />
      <BusinessGate>{(b) => <Planner business={b} supplier={supplier} />}</BusinessGate>
    </>
  );
}

function Planner({ business, supplier }: { business: Business; supplier?: string }) {
  const { c, t, scopeKey } = useApp();
  const { data, error, loading, refresh } = useLoad(() => loadOrderPlanner(business.id), scopeKey);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? t.error} onRetry={refresh} />;

  if (supplier) {
    const group = data.groups.find((g) => g.key === supplier);
    if (!group) return <ErrorState message={t.noProducts} onRetry={refresh} />;
    return <Builder group={group} business={data.business} />;
  }

  return (
    <FlatList
      data={data.groups}
      keyExtractor={(g) => g.key}
      contentContainerStyle={[panel(c), { gap: space.sm, marginBottom: space.xxl * 2 }]}
      ListHeaderComponent={
        <Text tone="slate" size={14} style={{ marginBottom: space.sm }}>
          {t.newOrderIntro}
        </Text>
      }
      ListEmptyComponent={<Empty text={t.noSuppliers} icon={<Truck size={40} color={c.slate} weight="duotone" />} />}
      renderItem={({ item: g }) => (
        <Card onPress={() => router.push({ pathname: '/new-order', params: { supplier: g.key } })} style={{ gap: 4 }}>
          <Row style={{ justifyContent: 'space-between', gap: space.sm }}>
            <Text weight="700" size={16} style={{ flex: 1 }} numberOfLines={1}>
              {g.supplierName ?? t.noSupplier}
            </Text>
            {g.needed > 0 ? (
              <View style={[styles.badge, { backgroundColor: c.alertSoft }]}>
                <Text size={12} weight="700" tone="alert">
                  {t.toReorderShort(g.needed)}
                </Text>
              </View>
            ) : null}
          </Row>
          <Text tone="slate" size={13} numberOfLines={1}>
            {g.supplierPhone ?? (g.supplierName ? t.noPhone : t.noSupplierHint)}
          </Text>
          <Text tone="slate" size={13} numberOfLines={1}>
            {g.rows
              .slice(0, 3)
              .map((r) => r.name)
              .join(', ')}
            {g.rows.length > 3 ? ` +${g.rows.length - 3}` : ''}
          </Text>
        </Card>
      )}
    />
  );
}

function Builder({ group, business }: { group: SupplierGroup; business: OrderBusiness | null }) {
  const { c, t, lang, allStores, stores } = useApp();
  const [picked, setPicked] = useState<Record<string, boolean>>(() => Object.fromEntries(group.rows.map((r) => [r.product_id, r.flagged])));
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(group.rows.map((r) => [r.product_id, r.flagged && r.reorderQty && r.reorderQty > 0 ? String(Math.ceil(r.reorderQty)) : '']))
  );
  const [days, setDays] = useState(group.leadDays);
  const [now] = useState(() => Date.now());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'create' | 'send' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const number = useMemo(() => whatsappNumber(group.supplierPhone, callingCode(business)), [group.supplierPhone, business]);
  const chosen = group.rows.filter((r) => picked[r.product_id]);
  const expected = localDay(now + days * DAY);
  const mainStore = stores.find((s) => s.isDefault)?.name;

  function toggle(id: string) {
    setError(null);
    setPicked((p) => ({ ...p, [id]: !p[id] }));
  }

  async function create(send: boolean) {
    setError(null);
    if (!chosen.length) return setError(t.tickProduct);
    const lines = chosen.map((r) => ({ r, q: Number((amounts[r.product_id] ?? '').replace(',', '.')) }));
    const bad = lines.filter(({ q, r }) => !(amounts[r.product_id] ?? '').trim() || !Number.isFinite(q) || q <= 0);
    if (bad.length) return setError(t.enterQtyFor(bad.map((b) => b.r.name).join(', ')));

    setBusy(send ? 'send' : 'create');
    try {
      const id = await createOrder({
        supplierName: group.supplierName,
        supplierPhone: group.supplierPhone,
        expected,
        note: note.trim() || null,
        lines: lines.map(({ r, q }) => ({ product_id: r.product_id, quantity: q })),
      });
      if (send && number.digits) {
        const message = orderMessage({
          businessName: business?.name ?? '',
          supplierName: group.supplierName,
          lines: lines.map(({ r, q }) => ({ name: r.name, quantity: q, unit: r.unit })),
          expected,
          note: note.trim() || null,
        });
        await Linking.openURL(whatsappLink(number.digits, message));
        await markSent(id);
      }
      // Back to the Orders tab, then open the new order.
      router.dismissAll();
      router.push({ pathname: '/order/[id]', params: { id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
      setBusy(null);
    }
  }

  const dateLabel = new Date(expected + 'T00:00:00').toLocaleDateString(lang === 'ar' ? 'ar' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        data={group.rows}
        keyExtractor={(r) => r.product_id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xl }}
        ListHeaderComponent={
          <View style={{ gap: 4, paddingVertical: space.md }}>
            <Text size={22} weight="800">
              {group.supplierName ?? t.noSupplier}
            </Text>
            <Text tone="slate">{group.supplierPhone ?? (group.supplierName ? t.noPhone : t.noSupplierHint)}</Text>
          </View>
        }
        renderItem={({ item: r }) => {
          const on = !!picked[r.product_id];
          return (
            <Row style={[styles.row, { borderBottomColor: c.hairline }]}>
              <Pressable
                onPress={() => toggle(r.product_id)}
                hitSlop={8}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={r.name}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <View style={[styles.tick, { borderColor: on ? c.brand : c.hairline, backgroundColor: on ? c.brand : 'transparent' }]}>
                  {on ? <Check size={16} color={c.onBrand} weight="bold" /> : null}
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text weight="600" numberOfLines={2}>
                    {r.name}
                  </Text>
                  <Text tone="slate" size={12} numberOfLines={1}>
                    {t.stock} {qty(r.current_stock)}
                    {r.unit ? ` ${r.unit}` : ''}
                    {r.onOrder ? ` · ${t.onOrder} ${qty(r.onOrder)}` : ''}
                    {r.days !== null ? ` · ${t.daysLeft(r.days)}` : ''}
                  </Text>
                  {r.flagged ? <RiskChip risk={r.risk} /> : null}
                </View>
              </Pressable>
              <TextInput
                value={amounts[r.product_id] ?? ''}
                onChangeText={(v) => {
                  setAmounts((a) => ({ ...a, [r.product_id]: v }));
                  if (v.trim() && !on) setPicked((p) => ({ ...p, [r.product_id]: true }));
                }}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={c.slate}
                selectTextOnFocus
                accessibilityLabel={`${t.quantity}: ${r.name}`}
                style={[styles.qty, { borderColor: on ? c.brand : c.hairline, color: c.ink, backgroundColor: c.card }]}
              />
            </Row>
          );
        }}
        ListFooterComponent={
          <View style={{ gap: space.md, paddingTop: space.lg }}>
            <Text tone="slate" size={13} weight="600">
              {t.deliveryBy}
            </Text>
            <Row style={{ gap: space.md }}>
              <Pressable
                onPress={() => setDays((d) => Math.max(0, d - 1))}
                accessibilityRole="button"
                accessibilityLabel="−1"
                style={[styles.step, { borderColor: c.hairline, backgroundColor: c.card }]}>
                <Text size={22} weight="700">
                  −
                </Text>
              </Pressable>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text size={17} weight="700">
                  {dateLabel}
                </Text>
                <Text tone="slate" size={12}>
                  {days === 0 ? t.today : t.inDays(days)}
                </Text>
              </View>
              <Pressable
                onPress={() => setDays((d) => Math.min(365, d + 1))}
                accessibilityRole="button"
                accessibilityLabel="+1"
                style={[styles.step, { borderColor: c.hairline, backgroundColor: c.card }]}>
                <Text size={22} weight="700">
                  +
                </Text>
              </Pressable>
            </Row>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={t.noteForSupplier}
              placeholderTextColor={c.slate}
              maxLength={500}
              multiline
              style={[styles.note, { borderColor: c.hairline, color: c.ink, backgroundColor: c.card }]}
            />
            {allStores && stores.length > 1 && mainStore ? (
              <Text tone="slate" size={13}>
                {t.orderGoesTo(mainStore)}
              </Text>
            ) : null}
            {group.supplierPhone && !number.digits ? (
              <Text tone="amber" size={13}>
                {number.needsCode ? t.phoneNeedsCode : t.phoneNotValid}
              </Text>
            ) : null}
          </View>
        }
      />
      <View style={[styles.footer, { backgroundColor: c.bg, borderTopColor: c.hairline }]}>
        {error ? <Text tone="alert">{error}</Text> : null}
        <Text tone="slate" size={13} style={{ textAlign: 'center' }}>
          {t.productsTicked(chosen.length)}
        </Text>
        {number.digits ? (
          <>
            <Pressable
              onPress={() => create(true)}
              disabled={!!busy}
              accessibilityRole="button"
              style={({ pressed }) => [styles.wa, { opacity: busy ? 0.6 : pressed ? 0.85 : 1 }]}>
              <WhatsappLogo size={20} color="#FFFFFF" weight="fill" />
              <Text weight="700" style={{ color: '#FFFFFF' }}>
                {busy === 'send' ? t.saving : t.createAndSend}
              </Text>
            </Pressable>
            <Button title={busy === 'create' ? t.saving : t.createOnly} variant="secondary" onPress={() => create(false)} disabled={!!busy} />
          </>
        ) : (
          <Button title={busy ? t.saving : t.createOrder} onPress={() => create(false)} loading={busy === 'create'} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
  row: { gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  tick: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  qty: { width: 80, minHeight: 46, borderWidth: 1.5, borderRadius: radius.md, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  step: { width: 52, height: 52, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  note: { minHeight: 70, borderWidth: 1, borderRadius: radius.md, padding: space.md, fontSize: 15, textAlignVertical: 'top' },
  footer: { padding: space.lg, paddingBottom: space.xxl, gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
  wa: { minHeight: 50, borderRadius: radius.md, backgroundColor: '#1FA855', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
});
