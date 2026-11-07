import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { Button, Card, Row, Segmented, Text } from '@/components/ui';
import { supabase, WEB_URL } from '@/lib/supabase';
import { space } from '@/lib/theme';
import { useApp } from '@/providers/app-provider';

export default function MoreScreen() {
  const { c, t, session, business, store, stores, allStores, lang, setLang, themePref, setThemePref } = useApp();

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

        <Button title={t.signOut} variant="danger" onPress={() => supabase.auth.signOut()} />

        <Text tone="slate" size={12} style={{ textAlign: 'center' }}>
          Naqisni · {t.version} {Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  link: { paddingVertical: space.md, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
});
