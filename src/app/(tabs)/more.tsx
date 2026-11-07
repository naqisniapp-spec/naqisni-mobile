import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { Button, Card, Row, Segmented, Text } from '@/components/ui';
import { disablePush, enablePush, savedPushToken } from '@/lib/push';
import { unreadCount } from '@/lib/support';
import { useLoad } from '@/lib/use-load';
import { supabase, WEB_URL } from '@/lib/supabase';
import { space } from '@/lib/theme';
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

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title={t.tabMore} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0, gap: space.lg, paddingBottom: space.xxl * 2 }}>
        <Card>
          <Text size={18} weight="700">
            {business?.name ?? '—'}
          </Text>
          <Text tone="slate">{session?.user.email}</Text>
        </Card>

        <Card onPress={() => router.push('/support')}>
          <Row style={{ justifyContent: 'space-between', gap: space.md }}>
            <Text weight="600">{t.support}</Text>
            <Row style={{ gap: space.sm }}>
              {unread ? (
                <View style={[styles.badge, { backgroundColor: c.brandDeep }]}>
                  <Text size={12} weight="700" style={{ color: c.card }}>
                    {unread}
                  </Text>
                </View>
              ) : null}
              <Text tone="slate">›</Text>
            </Row>
          </Row>
        </Card>

        {stores.length > 0 && (
          <Card onPress={stores.length > 1 ? () => router.push('/stores') : undefined}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text tone="slate">{t.store}</Text>
              <Text weight="600">
                {allStores ? t.allStores : (store?.name ?? '—')}
                {stores.length > 1 ? '  ›' : ''}
              </Text>
            </Row>
          </Card>
        )}

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1 }}>
              <Text weight="600">{t.notifications}</Text>
              <Text tone="slate" size={13}>
                {t.notificationsHint}
              </Text>
            </View>
            <Switch
              value={pushOn}
              disabled={pushBusy || !business}
              onValueChange={togglePush}
              trackColor={{ true: c.brand, false: c.hairline }}
              thumbColor={c.card}
            />
          </View>
          {pushNote ? (
            <Text tone="amber" size={13} style={{ marginTop: space.sm }}>
              {pushNote}
            </Text>
          ) : null}
        </Card>

        <View style={{ gap: space.sm }}>
          <Text tone="slate" size={13} weight="600">
            {t.language}
          </Text>
          <Segmented
            value={lang}
            onChange={setLang}
            options={[
              { value: 'en', label: 'English' },
              { value: 'ar', label: 'العربية' },
            ]}
          />
        </View>

        <View style={{ gap: space.sm }}>
          <Text tone="slate" size={13} weight="600">
            {t.theme}
          </Text>
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

        <Pressable onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/dashboard`)} style={[styles.link, { borderColor: c.hairline }]}>
          <Text tone="brand" weight="600">
            {t.openWebsite}
          </Text>
        </Pressable>

        <Button title={t.signOut} variant="danger" onPress={signOut} />

        <Text tone="slate" size={12} style={{ textAlign: 'center' }}>
          Naqisni · {t.version} {Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { minWidth: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  link: { paddingVertical: space.md, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
});
