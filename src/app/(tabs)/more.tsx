import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Bell, CaretRight, ChartBar, ChatCircleDots, ClipboardText, Clock, ClockCounterClockwise, FileText, GearSix, Globe, Moon, SignOut, Storefront, Trash, Truck } from '@/components/icons';
import { ScreenHeader } from '@/components/screen-header';
import { Segmented, Text } from '@/components/ui';
import { disablePush, enablePush, savedPushToken } from '@/lib/push';
import { unreadCount } from '@/lib/support';
import { useLoad } from '@/lib/use-load';
import { supabase, WEB_URL } from '@/lib/supabase';
import { radius, space } from '@/lib/theme';
import { useApp } from '@/providers/app-provider';

export default function MoreScreen() {
  const { c, t, session, business, store, stores, allStores, lang, setLang, themePref, setThemePref } = useApp();
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushNote, setPushNote] = useState<string | null>(null);
  const { data: unread } = useLoad(() => (business ? unreadCount(business.id) : Promise.resolve(0)), business?.id ?? '');

  useEffect(() => {
    savedPushToken().then((tk) => setPushOn(Boolean(tk)));
  }, []);

  async function togglePush(next: boolean) {
    if (!business || !session) return;
    setPushBusy(true);
    setPushNote(null);
    if (next) {
      const res = await enablePush(business.id, session.user.id, lang);
      setPushOn(res.ok);
      if (!res.ok) setPushNote(t.pushProblem[res.problem]);
    } else {
      await disablePush().catch(() => undefined);
      setPushOn(false);
    }
    setPushBusy(false);
  }

  async function signOut() {
    // This phone should stop getting this business's alerts.
    await disablePush().catch(() => undefined);
    await supabase.auth.signOut();
  }

  const initial = (business?.name ?? session?.user.email ?? '?').slice(0, 1).toUpperCase();

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title={t.tabMore} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0, gap: space.xl, paddingBottom: space.xxl * 2 }}>
        <View style={[styles.profile, { backgroundColor: c.card, borderColor: c.hairline }]}>
          <View style={[styles.avatar, { backgroundColor: c.ink }]}>
            <Text size={22} weight="700" style={{ color: c.brand }}>
              {initial}
            </Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text size={18} weight="700" numberOfLines={1}>
              {business?.name ?? '—'}
            </Text>
            <Text tone="slate" size={14} numberOfLines={1}>
              {session?.user.email}
            </Text>
          </View>
          {business?.plan ? (
            <View style={[styles.plan, { backgroundColor: c.brandSoft }]}>
              <Text size={12} weight="600" tone="brand" style={{ textTransform: 'capitalize' }}>
                {business.plan}
              </Text>
            </View>
          ) : null}
        </View>

        {Platform.OS !== 'web' && <UpdateReady />}

        <Group>
          <Item Icon={ClipboardText} label={t.countStock} hint={t.countStockHint} onPress={() => router.push('/count')} />
          <Item Icon={ClockCounterClockwise} label={t.stockHistory} onPress={() => router.push('/history')} />
          <Item Icon={Clock} label={t.expiryDates} onPress={() => router.push('/expiry')} />
        </Group>

        <Group>
          <Item Icon={Truck} label={t.suppliers} onPress={() => router.push('/suppliers')} />
          <Item Icon={ChartBar} label={t.reports} onPress={() => router.push('/reports')} />
          <Item Icon={GearSix} label={t.alertSettings} onPress={() => router.push('/alert-settings')} />
        </Group>

        <Group>
          <Item Icon={ChatCircleDots} label={t.support} onPress={() => router.push('/support')} badge={unread || undefined} />
          {stores.length > 0 && (
            <Item
              Icon={Storefront}
              label={t.store}
              value={allStores ? t.allStores : (store?.name ?? '—')}
              onPress={stores.length > 1 ? () => router.push('/stores') : undefined}
            />
          )}
          <Item
            Icon={Bell}
            label={t.notifications}
            hint={pushNote ?? t.notificationsHint}
            hintTone={pushNote ? 'amber' : 'slate'}
            right={
              <Switch
                value={pushOn}
                disabled={pushBusy || !business}
                onValueChange={togglePush}
                trackColor={{ true: c.brand, false: c.hairline }}
                thumbColor="#FFFFFF"
              />
            }
          />
        </Group>

        <Group>
          <View style={styles.setting}>
            <Row Icon={Globe} label={t.language} />
            <Segmented
              value={lang}
              onChange={setLang}
              options={[
                { value: 'en', label: 'English' },
                { value: 'ar', label: 'العربية' },
              ]}
            />
          </View>
          <View style={[styles.setting, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline }]}>
            <Row Icon={Moon} label={t.theme} />
            <Segmented
              value={themePref}
              onChange={setThemePref}
              options={[
                { value: 'system', label: t.system },
                { value: 'light', label: t.light },
                { value: 'dark', label: t.dark },
              ]}
            />
          </View>
        </Group>

        <Group>
          <Item Icon={Globe} label={t.openWebsite} onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/dashboard`)} />
          <Item Icon={FileText} label={t.privacyPolicy} onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/privacy`)} />
          <Item Icon={SignOut} label={t.signOut} onPress={signOut} danger />
        </Group>

        <Group>
          <Item Icon={Trash} label={t.deleteAccount} onPress={() => router.push('/delete-account')} danger />
        </Group>

        <Text tone="slate" size={12} style={{ textAlign: 'center' }}>
          Naqisni · {t.version} {Constants.expoConfig?.version ?? '2.0.0'}
        </Text>
      </ScrollView>
    </View>
  );
}

type IconType = ComponentType<{ size?: number; color?: string; weight?: 'regular' | 'bold' | 'fill' | 'duotone' }>;

/** Shown when an over-the-air update has downloaded; it would otherwise apply on the next app start. */
function UpdateReady() {
  const { c, t } = useApp();
  const { isUpdatePending } = Updates.useUpdates();
  if (!isUpdatePending) return null;
  return (
    <Pressable
      onPress={() => Updates.reloadAsync().catch(() => undefined)}
      style={({ pressed }) => [styles.update, { backgroundColor: c.brandSoft, borderColor: c.brand, opacity: pressed ? 0.8 : 1 }]}
      accessibilityRole="button">
      <Text weight="700">{t.updateReady}</Text>
      <Text tone="brand" size={14} weight="600">
        {t.restartToUpdate}
      </Text>
    </Pressable>
  );
}

function Group({ children }: { children: ReactNode }) {
  const { c } = useApp();
  return <View style={[styles.group, { backgroundColor: c.card, borderColor: c.hairline }]}>{children}</View>;
}

function Row({ Icon, label, danger }: { Icon: IconType; label: string; danger?: boolean }) {
  const { c } = useApp();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <View style={[styles.icon, { backgroundColor: danger ? c.alertSoft : c.brandSoft }]}>
        <Icon size={18} color={danger ? c.alert : c.brandDeep} weight="bold" />
      </View>
      <Text weight="600" style={danger ? { color: c.alert } : undefined}>
        {label}
      </Text>
    </View>
  );
}

/** One settings row. Rows after the first in a group get a divider. */
function Item({
  Icon,
  label,
  value,
  hint,
  hintTone = 'slate',
  badge,
  right,
  onPress,
  danger,
}: {
  Icon: IconType;
  label: string;
  value?: string;
  hint?: string;
  hintTone?: 'slate' | 'amber';
  badge?: number;
  right?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
}) {
  const { c, rtl } = useApp();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.item, styles.divider, { borderTopColor: c.hairline }, pressed && { backgroundColor: c.hairline }]}
      accessibilityRole={onPress ? 'button' : undefined}>
      <View style={{ flex: 1, gap: 4 }}>
        <Row Icon={Icon} label={label} danger={danger} />
        {hint ? (
          <Text tone={hintTone} size={13} style={{ marginStart: 44 }}>
            {hint}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text tone="slate" size={14} numberOfLines={1} style={{ maxWidth: 150 }}>
          {value}
        </Text>
      ) : null}
      {badge ? (
        <View style={[styles.badge, { backgroundColor: c.brandDeep }]}>
          <Text size={12} weight="700" style={{ color: c.card }}>
            {badge}
          </Text>
        </View>
      ) : null}
      {right}
      {onPress && !danger ? <CaretRight size={16} color={c.slate} style={rtl ? { transform: [{ scaleX: -1 }] } : undefined} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  avatar: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  plan: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  update: { borderRadius: radius.lg, borderWidth: 1, padding: space.lg, gap: 2 },
  group: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: 14 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: -StyleSheet.hairlineWidth },
  setting: { padding: space.lg, gap: space.md },
  icon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  badge: { minWidth: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
});
