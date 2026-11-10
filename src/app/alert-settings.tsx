import { Stack } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { BusinessGate } from '@/components/business-gate';
import { Button, Card, ErrorState, Loading, panel, Row, Text } from '@/components/ui';
import { loadAlertSettings, saveAlertSettings, type AlertSettings } from '@/lib/alert-settings';
import type { Business } from '@/lib/data';
import { radius, space } from '@/lib/theme';
import { useLoad } from '@/lib/use-load';
import { useApp } from '@/providers/app-provider';

/** Where low-stock alerts go, which ones, and quiet hours — the website's My account + Alert settings, in one place. */
export default function AlertSettingsScreen() {
  const { t } = useApp();
  return (
    <>
      <Stack.Screen options={{ title: t.alertSettings }} />
      <BusinessGate>{(b) => <Settings business={b} />}</BusinessGate>
    </>
  );
}

function Settings({ business }: { business: Business }) {
  const { t } = useApp();
  const { data, error, loading, refresh } = useLoad(() => loadAlertSettings(business.id), `alerts:${business.id}`);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? t.error} onRetry={refresh} />;
  return <Form business={business} initial={data} />;
}

const hour = (h: number) => `${String(h).padStart(2, '0')}:00`;

function Form({ business, initial }: { business: Business; initial: AlertSettings }) {
  const { c, t } = useApp();
  const owner = business.role === 'owner';
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'brand' | 'alert'; text: string } | null>(null);

  function set<K extends keyof AlertSettings>(key: K, value: AlertSettings[K]) {
    setNote(null);
    setV((x) => ({ ...x, [key]: value }));
  }

  async function save() {
    setBusy(true);
    setNote(null);
    try {
      await saveAlertSettings(business.id, initial, v);
      setNote({ tone: 'brand', text: t.saved });
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      const known: Record<string, string> = {
        needEmail: t.needAlertEmail,
        needWhatsApp: t.needAlertWhatsApp,
        whatsappCode: t.whatsappNeedsCode,
        whatsappBad: t.whatsappBad,
        quietSame: t.quietSame,
      };
      setNote({ tone: 'alert', text: known[code] ?? (code || t.error) });
    } finally {
      setBusy(false);
    }
  }

  const input = [styles.input, { backgroundColor: owner ? c.bg : c.hairline, borderColor: c.hairline, color: c.ink }];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={[panel(c), { gap: space.lg, marginBottom: space.xxl * 2 }]} keyboardShouldPersistTaps="handled">
        {!owner ? (
          <View style={[styles.notice, { backgroundColor: c.amberSoft }]}>
            <Text tone="amber">{t.ownerOnly}</Text>
          </View>
        ) : null}

        <Card style={{ gap: space.md }}>
          <Text size={17} weight="700">
            {t.whereAlertsGo}
          </Text>
          <Row style={{ gap: space.md }}>
            <Text weight="600" style={{ flex: 1 }}>
              {t.emailAlerts}
            </Text>
            <Switch disabled={!owner} value={v.email} onValueChange={(x) => set('email', x)} trackColor={{ true: c.brand, false: c.hairline }} thumbColor="#FFFFFF" />
          </Row>
          <TextInput
            editable={owner}
            value={v.notificationEmail}
            onChangeText={(x) => set('notificationEmail', x)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="you@shop.com"
            placeholderTextColor={c.slate}
            style={input}
          />
          <Row style={{ gap: space.md, marginTop: space.sm }}>
            <Text weight="600" style={{ flex: 1 }}>
              {t.whatsappAlerts}
            </Text>
            <Switch disabled={!owner} value={v.whatsapp} onValueChange={(x) => set('whatsapp', x)} trackColor={{ true: c.brand, false: c.hairline }} thumbColor="#FFFFFF" />
          </Row>
          <TextInput
            editable={owner}
            value={v.whatsappNumber}
            onChangeText={(x) => set('whatsappNumber', x)}
            keyboardType="phone-pad"
            placeholder="+252 63 412 3456"
            placeholderTextColor={c.slate}
            style={input}
          />
          <Text tone="slate" size={12}>
            {t.phoneAlertsHint}
          </Text>
        </Card>

        <Card style={{ gap: space.md }}>
          <Text size={17} weight="700">
            {t.whichAlerts}
          </Text>
          {(
            [
              ['all', t.levelAll, t.levelAllHint],
              ['critical', t.levelCritical, t.levelCriticalHint],
            ] as const
          ).map(([value, title, hint]) => {
            const on = v.level === value;
            return (
              <Pressable
                key={value}
                disabled={!owner}
                onPress={() => set('level', value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={[styles.option, { borderColor: on ? c.brand : c.hairline, backgroundColor: on ? c.brandSoft : c.card }]}>
                <View style={[styles.radio, { borderColor: on ? c.brandDeep : c.slate }]}>{on ? <View style={[styles.dot, { backgroundColor: c.brandDeep }]} /> : null}</View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text weight="600">{title}</Text>
                  <Text tone="slate" size={13}>
                    {hint}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </Card>

        <Card style={{ gap: space.md }}>
          <Row style={{ gap: space.md }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text size={17} weight="700">
                {t.quietHours}
              </Text>
              <Text tone="slate" size={13}>
                {t.quietHoursHint}
              </Text>
            </View>
            <Switch disabled={!owner} value={v.quietOn} onValueChange={(x) => set('quietOn', x)} trackColor={{ true: c.brand, false: c.hairline }} thumbColor="#FFFFFF" />
          </Row>
          {v.quietOn ? (
            <Row style={{ gap: space.md }}>
              <HourStepper label={t.from} value={v.quietStart} onChange={(h) => set('quietStart', h)} disabled={!owner} />
              <HourStepper label={t.until} value={v.quietEnd} onChange={(h) => set('quietEnd', h)} disabled={!owner} />
            </Row>
          ) : null}
        </Card>

        {note ? <Text tone={note.tone}>{note.text}</Text> : null}
        {owner ? <Button title={busy ? t.saving : t.save} onPress={save} loading={busy} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function HourStepper({ label, value, onChange, disabled }: { label: string; value: number; onChange: (h: number) => void; disabled: boolean }) {
  const { c } = useApp();
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Text tone="slate" size={13} weight="600">
        {label}
      </Text>
      <Row style={[styles.stepper, { borderColor: c.hairline, backgroundColor: c.bg }]}>
        <Pressable disabled={disabled} onPress={() => onChange((value + 23) % 24)} hitSlop={6} style={styles.stepBtn} accessibilityLabel="−1">
          <Text size={20} weight="700">
            −
          </Text>
        </Pressable>
        <Text size={17} weight="700" style={{ flex: 1, textAlign: 'center' }}>
          {hour(value)}
        </Text>
        <Pressable disabled={disabled} onPress={() => onChange((value + 1) % 24)} hitSlop={6} style={styles.stepBtn} accessibilityLabel="+1">
          <Text size={20} weight="700">
            +
          </Text>
        </Pressable>
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { padding: space.md, borderRadius: radius.md },
  input: { minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, fontSize: 16 },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1.5 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  stepper: { borderWidth: 1, borderRadius: radius.md, minHeight: 48, paddingHorizontal: space.sm },
  stepBtn: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
});
