import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { BusinessGate } from '@/components/business-gate';
import { Phone, WhatsappLogo } from '@/components/icons';
import { Button, Card, ErrorState, Loading, RiskChip, Row, Text } from '@/components/ui';
import type { Business } from '@/lib/data';
import { callingCode, whatsappNumber } from '@/lib/orders';
import { isSynced } from '@/lib/products';
import { qty } from '@/lib/stock';
import { loadSupplier, saveSupplier, SupplierError, type Supplier, type SupplierSettings } from '@/lib/suppliers';
import { radius, space } from '@/lib/theme';
import { useLoad } from '@/lib/use-load';
import { useApp } from '@/providers/app-provider';

/** One supplier: contact, products, orders, delivery record, and its name, phone and order settings. */
export default function SupplierScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  return <BusinessGate>{(b) => <SupplierView business={b} supplierKey={key} />}</BusinessGate>;
}

function SupplierView({ business, supplierKey }: { business: Business; supplierKey: string }) {
  const { c, t, lang, scopeKey } = useApp();
  const { data, error, loading, refreshing, refresh } = useLoad(() => loadSupplier(business.id, supplierKey), `${scopeKey}:${supplierKey}`);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? t.noSuppliersYet} onRetry={refresh} />;
  const { supplier: s, settings } = data;
  const wa = whatsappNumber(s.phone, callingCode(data.business)).digits;
  const onTime = s.received ? Math.round(((s.received - s.lateDeliveries) / s.received) * 100) : null;
  const editable = s.products.some((p) => !isSynced(p.source));
  const date = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const status: Record<string, string> = { draft: t.drafts, open: t.open, received: t.orderReceived, cancelled: t.cancelled };

  return (
    <>
      <Stack.Screen options={{ title: s.name }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView
          contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.brandDeep} />}>
          <View style={{ gap: 4 }}>
            <Text size={24} weight="800">
              {s.name}
            </Text>
            <Text tone="slate">{[s.phone ?? t.noPhone, settings?.email].filter(Boolean).join(' · ')}</Text>
            {settings?.auto_reorder ? (
              <View style={[styles.chip, { backgroundColor: c.brandSoft }]}>
                <Text size={12} weight="700" tone="brand">
                  {t.autoReorderOn}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={{ gap: space.sm }}>
            {s.low > 0 ? (
              <Button title={t.orderProducts(s.low)} onPress={() => router.push({ pathname: '/new-order', params: { supplier: s.key } })} />
            ) : null}
            <Row style={{ gap: space.sm }}>
              {wa ? (
                <Pressable onPress={() => Linking.openURL(`https://wa.me/${wa}`)} style={({ pressed }) => [styles.action, styles.wa, pressed && { opacity: 0.85 }]}>
                  <WhatsappLogo size={18} color="#FFFFFF" weight="fill" />
                  <Text weight="700" style={{ color: '#FFFFFF' }}>
                    WhatsApp
                  </Text>
                </Pressable>
              ) : null}
              {s.phone ? (
                <Pressable
                  onPress={() => Linking.openURL(`tel:${s.phone}`)}
                  style={({ pressed }) => [styles.action, { backgroundColor: c.card, borderColor: c.hairline, borderWidth: 1 }, pressed && { opacity: 0.7 }]}>
                  <Phone size={18} color={c.ink} weight="bold" />
                  <Text weight="700">{t.call}</Text>
                </Pressable>
              ) : null}
            </Row>
          </View>

          <View style={styles.stats}>
            <Stat label={t.tabProducts} value={String(s.products.length)} />
            <Stat label={t.runningLow} value={String(s.low)} />
            <Stat label={t.deliveryTime} value={s.leadDays ? t.daysShort(s.leadDays) : '—'} />
            <Stat label={t.onTime} value={onTime === null ? '—' : `${onTime}%`} />
          </View>

          {s.products.length > 0 && (
            <Card style={{ paddingVertical: space.sm }}>
              <Text tone="slate" size={13} weight="600" style={{ paddingTop: space.sm }}>
                {t.tabProducts}
              </Text>
              {s.products.map((p, i) => (
                <Pressable
                  key={p.product_id}
                  onPress={() => router.push({ pathname: '/product/[id]', params: { id: p.product_id } })}
                  style={({ pressed }) => [styles.line, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline }, pressed && { opacity: 0.6 }]}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text weight="500" numberOfLines={2}>
                      {p.name}
                    </Text>
                    {p.risk === 'critical' || p.risk === 'warning' ? <RiskChip risk={p.risk} /> : null}
                  </View>
                  <Text weight="700">
                    {qty(p.current_stock)}
                    {p.unit ? ` ${p.unit}` : ''}
                  </Text>
                </Pressable>
              ))}
            </Card>
          )}

          {s.orders.length > 0 && (
            <Card style={{ paddingVertical: space.sm }}>
              <Text tone="slate" size={13} weight="600" style={{ paddingTop: space.sm }}>
                {t.tabOrders}
              </Text>
              {s.orders.slice(0, 30).map((o, i) => {
                const late = o.status === 'received' && o.received_at && o.expected_at && o.received_at.slice(0, 10) > o.expected_at.slice(0, 10);
                return (
                  <Pressable
                    key={o.id}
                    onPress={() => router.push({ pathname: '/order/[id]', params: { id: o.id } })}
                    style={({ pressed }) => [styles.line, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline }, pressed && { opacity: 0.6 }]}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text weight="500">{date(o.ordered_at)}</Text>
                      <Text tone="slate" size={12}>
                        {status[o.status] ?? o.status}
                        {o.received_at ? ` · ${t.receivedOn(date(o.received_at))}` : o.expected_at ? ` · ${t.expected} ${date(o.expected_at)}` : ''}
                      </Text>
                    </View>
                    {late ? (
                      <Text size={12} weight="700" tone="amber">
                        {t.late}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </Card>
          )}

          {editable ? <SupplierEditor business={business} supplier={s} settings={settings} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function SupplierEditor({ business, supplier, settings }: { business: Business; supplier: Supplier; settings: SupplierSettings | null }) {
  const { c, t } = useApp();
  const [name, setName] = useState(supplier.name);
  const [phone, setPhone] = useState(supplier.phone ?? '');
  const [email, setEmail] = useState(settings?.email ?? '');
  const [auto, setAuto] = useState(Boolean(settings?.auto_reorder));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'brand' | 'alert'; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setNote(null);
    try {
      const key = await saveSupplier(business.id, supplier.name, { name, phone, email, autoReorder: auto });
      if (key !== supplier.key) {
        router.replace({ pathname: '/supplier/[key]', params: { key } });
        return;
      }
      setNote({ tone: 'brand', text: auto ? t.supplierSavedAuto : t.supplierSaved });
    } catch (e) {
      if (e instanceof SupplierError) {
        const text = { name: t.supplierNeedName, email: t.checkEmail, autoNeedsContact: t.autoNeedsContact, settings: t.supplierSettingsFailed(e.message) }[e.code];
        setNote({ tone: 'alert', text });
      } else setNote({ tone: 'alert', text: e instanceof Error ? e.message : t.error });
    } finally {
      setBusy(false);
    }
  }

  const input = [styles.input, { backgroundColor: c.bg, borderColor: c.hairline, color: c.ink }];
  return (
    <Card style={{ gap: space.md }}>
      <View style={{ gap: 2 }}>
        <Text size={17} weight="700">
          {t.editSupplier}
        </Text>
        <Text tone="slate" size={13}>
          {t.editSupplierHint}
        </Text>
      </View>
      <Label text={t.supplierName} />
      <TextInput value={name} onChangeText={setName} style={input} placeholderTextColor={c.slate} />
      <Label text={t.supplierPhone} hint={t.supplierPhoneHint} />
      <TextInput value={phone} onChangeText={setPhone} style={input} keyboardType="phone-pad" placeholder="+252 63 123 4567" placeholderTextColor={c.slate} />
      <Label text={t.ordersEmail} />
      <TextInput
        value={email}
        onChangeText={setEmail}
        style={input}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="orders@supplier.com"
        placeholderTextColor={c.slate}
      />
      <Row style={{ gap: space.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text weight="600">{t.autoReorder}</Text>
          <Text tone="slate" size={12}>
            {t.autoReorderHint}
          </Text>
        </View>
        <Switch value={auto} onValueChange={setAuto} trackColor={{ true: c.brand, false: c.hairline }} thumbColor="#FFFFFF" />
      </Row>
      {note ? <Text tone={note.tone}>{note.text}</Text> : null}
      <Button title={busy ? t.saving : t.save} onPress={save} loading={busy} />
    </Card>
  );
}

function Label({ text, hint }: { text: string; hint?: string }) {
  return (
    <View style={{ gap: 2, marginBottom: -4 }}>
      <Text tone="slate" size={13} weight="600">
        {text}
      </Text>
      {hint ? (
        <Text tone="slate" size={12}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { c } = useApp();
  return (
    <View style={[styles.stat, { backgroundColor: c.card, borderColor: c.hairline }]}>
      <Text tone="slate" size={12} weight="600">
        {label}
      </Text>
      <Text size={17} weight="700" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, marginTop: 4 },
  action: { flex: 1, minHeight: 48, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  wa: { backgroundColor: '#1FA855' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  stat: { flexBasis: '48%', flexGrow: 1, padding: space.md, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  input: { minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, fontSize: 16 },
});
