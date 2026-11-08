import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Button, Card, ErrorState, Loading, Row, Text } from '@/components/ui';
import { WhatsappLogo } from '@/components/icons';
import { loadOrder, receiveDelivery } from '@/lib/data';
import { callingCode, loadOrderBusiness, markSent, orderMessage, whatsappLink, whatsappNumber } from '@/lib/orders';
import { qty } from '@/lib/stock';
import { webApi } from '@/lib/supabase';
import { radius, space } from '@/lib/theme';
import { useLoad } from '@/lib/use-load';
import { useApp } from '@/providers/app-provider';

type ApproveResult = { sent?: unknown; waitingFor?: string[] };

/**
 * A supplier order. Drafts from auto-reorder can be adjusted and approved here;
 * approval runs on naqisni.com (POST /api/orders/:id/approve) so the supplier
 * email/WhatsApp and the approver list work exactly like on the website.
 */
export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, t, lang, scopeKey, business } = useApp();
  const { data: order, error, loading, refresh, reload } = useLoad(() => loadOrder(id), `${scopeKey}:${id}`);
  /** Quantities the person changed; the rest keep the draft's numbers. */
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'alert' | 'brand'; text: string } | null>(null);
  /** Recording what arrived: quantities per product, filled in with what is still to come. */
  const [receiving, setReceiving] = useState<Record<string, string> | null>(null);


  if (loading) return <Loading />;
  if (error || !order) return <ErrorState message={error ?? t.noOrders} onRetry={refresh} />;
  const isDraft = order.status === 'draft';
  const isOpen = order.status === 'open';
  const left = (l: (typeof order.purchase_order_lines)[number]) => Math.max(0, Number(l.quantity) - Number(l.received_quantity ?? 0));
  // Products from a connected system get their stock from that system, so deliveries are recorded there.
  const canReceive = (l: (typeof order.purchase_order_lines)[number]) => (l.products?.source ?? 'manual') === 'manual' && left(l) > 0;
  const receivable = order.purchase_order_lines.filter(canReceive);

  function startReceiving() {
    setMessage(null);
    setReceiving(Object.fromEntries(receivable.map((l) => [l.product_id, qty(left(l))])));
  }

  // Orders made by hand are sent by the owner on WhatsApp (auto-reorder orders go out on approval).
  const canSend = isOpen && !order.auto && !order.sent_at && Boolean(order.supplier_phone);

  async function sendWhatsApp() {
    if (!business || !order) return;
    setMessage(null);
    const info = await loadOrderBusiness(business.id);
    const number = whatsappNumber(order.supplier_phone, callingCode(info));
    if (!number.digits) return setMessage({ tone: 'alert', text: number.needsCode ? t.phoneNeedsCode : t.phoneNotValid });
    const text = orderMessage({
      businessName: info?.name ?? business.name,
      supplierName: order.supplier_name,
      lines: order.purchase_order_lines.map((l) => ({ name: l.products?.name ?? '', quantity: Number(l.quantity), unit: l.products?.unit ?? null })),
      expected: order.expected_at,
      note: order.note ?? null,
    });
    await Linking.openURL(whatsappLink(number.digits, text));
    await markSent(order.id);
    reload();
  }

  async function saveDelivery() {
    if (!receiving || !business) return;
    const lines = Object.entries(receiving).map(([product_id, v]) => ({ product_id, quantity: Number(v.replace(',', '.')) }));
    if (lines.some((l) => Number.isNaN(l.quantity) || l.quantity < 0)) return setMessage({ tone: 'alert', text: t.enterQuantity });
    if (!lines.some((l) => l.quantity > 0)) return setMessage({ tone: 'alert', text: t.nothingArrived });
    setBusy(true);
    setMessage(null);
    try {
      const res = await receiveDelivery(business.id, lines);
      setMessage(
        res.failed.length
          ? { tone: 'alert', text: t.deliveryPartlySaved(res.failed.length) }
          : { tone: 'brand', text: t.deliverySaved(res.saved) }
      );
      setReceiving(null);
      reload();
    } catch (e) {
      setMessage({ tone: 'alert', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    setBusy(true);
    setMessage(null);
    try {
      const lines = order!.purchase_order_lines;
      const body = {
        quantities: Object.fromEntries(lines.map((l) => [l.product_id, Number((edits[l.product_id] ?? String(l.quantity)).replace(',', '.')) || 0])),
      };
      const res = await webApi<ApproveResult>(`/api/orders/${id}/approve`, body);
      setMessage({ tone: 'brand', text: res.waitingFor?.length ? t.waitingFor(res.waitingFor.length) : t.sentToSupplier });
      setEdits({});
      reload();
    } catch (e) {
      setMessage({ tone: 'alert', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: order.supplier_name ?? '' }} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 4 }}>
          <Text size={22} weight="800">
            {order.supplier_name ?? '—'}
          </Text>
          <Text tone="slate">
            {isDraft ? t.drafts : isOpen ? t.open : order.status === 'received' ? t.orderReceived : order.status}
            {order.auto ? ` · ${t.autoOrder}` : ''}
            {isOpen && !order.auto ? ` · ${order.sent_at ? t.sent : t.notSentYet}` : ''}
            {order.expected_at
              ? ` · ${t.expected} ${new Date(order.expected_at + 'T00:00:00Z').toLocaleDateString(lang === 'ar' ? 'ar' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}`
              : ''}
          </Text>
        </View>

        {receiving ? (
          <View style={[styles.hint, { backgroundColor: c.brandSoft }]}>
            <Text tone="brand">{t.deliveryHint}</Text>
          </View>
        ) : null}

        <Card style={{ paddingVertical: space.sm }}>
          {order.purchase_order_lines.map((l, i) => (
            <Row key={l.product_id} style={[styles.line, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text weight="500" numberOfLines={2}>
                  {l.products?.name ?? '—'}
                </Text>
                {!isDraft && Number(l.received_quantity ?? 0) > 0 ? (
                  <Text tone={left(l) === 0 ? 'brand' : 'slate'} size={12}>
                    {left(l) === 0 ? t.allArrived : t.arrivedOf(qty(Number(l.received_quantity)), qty(l.quantity))}
                  </Text>
                ) : null}
                {receiving && !canReceive(l) && left(l) > 0 ? (
                  <Text tone="slate" size={12}>
                    {t.receiveInSystem}
                  </Text>
                ) : null}
              </View>
              {receiving && canReceive(l) ? (
                <TextInput
                  value={receiving[l.product_id] ?? ''}
                  onChangeText={(v) => setReceiving((r) => ({ ...r, [l.product_id]: v }))}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  accessibilityLabel={`${t.arrived}: ${l.products?.name ?? ''}`}
                  style={[styles.qty, { borderColor: c.brand, color: c.ink, backgroundColor: c.bg }]}
                />
              ) : isDraft ? (
                <TextInput
                  value={edits[l.product_id] ?? qty(l.quantity)}
                  onChangeText={(v) => setEdits((q) => ({ ...q, [l.product_id]: v }))}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  style={[styles.qty, { borderColor: c.hairline, color: c.ink, backgroundColor: c.bg }]}
                />
              ) : (
                <Text weight="700">{qty(l.quantity)}</Text>
              )}
              {l.products?.unit ? (
                <Text tone="slate" size={13}>
                  {l.products.unit}
                </Text>
              ) : null}
            </Row>
          ))}
        </Card>

        {message && <Text tone={message.tone}>{message.text}</Text>}
      </ScrollView>

      {isDraft && (
        <View style={[styles.footer, { backgroundColor: c.bg, borderTopColor: c.hairline }]}>
          <Button title={busy ? t.approving : t.approveSend} onPress={approve} loading={busy} />
        </View>
      )}
      {isOpen && receivable.length > 0 && (
        <View style={[styles.footer, { backgroundColor: c.bg, borderTopColor: c.hairline }]}>
          {receiving ? (
            <Row style={{ gap: space.md }}>
              <Button title={t.cancel} variant="secondary" onPress={() => setReceiving(null)} style={{ flex: 1 }} />
              <Button title={busy ? t.saving : t.saveDelivery} onPress={saveDelivery} loading={busy} style={{ flex: 2 }} />
            </Row>
          ) : (
            <View style={{ gap: space.sm }}>
              {canSend ? (
                <Pressable onPress={sendWhatsApp} accessibilityRole="button" style={({ pressed }) => [styles.wa, pressed && { opacity: 0.85 }]}>
                  <WhatsappLogo size={20} color="#FFFFFF" weight="fill" />
                  <Text weight="700" style={{ color: '#FFFFFF' }}>
                    {t.sendOnWhatsApp}
                  </Text>
                </Pressable>
              ) : null}
              <Button title={t.recordDelivery} onPress={startReceiving} variant={canSend ? 'secondary' : 'primary'} />
            </View>
          )}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  line: { paddingVertical: space.md, gap: space.sm },
  qty: { width: 76, minHeight: 40, borderWidth: 1, borderRadius: radius.sm, textAlign: 'center', fontSize: 16, fontWeight: '600' },
  wa: { minHeight: 50, borderRadius: radius.md, backgroundColor: '#1FA855', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  hint: { padding: space.md, borderRadius: radius.md },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.lg, paddingBottom: space.xxl, borderTopWidth: StyleSheet.hairlineWidth },
});
