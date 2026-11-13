/**
 * What Naqisni's remote controls show (set in naqisni.com/admin/mobile):
 * the maintenance screen, the "please update" screen, the message banner,
 * and the screen for a feature that was switched off.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as Updates from 'expo-updates';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ArrowCircleUp, Megaphone, Prohibit, Warning, Wrench, X } from '@/components/icons';
import { Logo } from '@/components/logo';
import { Button, Centered, Text } from '@/components/ui';
import { appVersion, needsUpdate, pick, PLAY_STORE_URL, type Feature } from '@/lib/remote-config';
import { radius, space } from '@/lib/theme';
import { useApp } from '@/providers/app-provider';
import { useFeature, useRemoteConfig } from '@/providers/remote-config-provider';

/** A full screen on Naqisni navy, used for maintenance and forced updates. */
function Blocker({ icon, title, body, children }: { icon: ReactNode; title: string; body: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.blocker, { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl }]}>
      <Logo width={120} />
      <View style={styles.blockerBody}>
        <View style={styles.blockerIcon}>{icon}</View>
        <Text size={22} weight="700" style={{ color: '#FFFFFF', textAlign: 'center' }}>
          {title}
        </Text>
        <Text size={16} style={{ color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 24 }}>
          {body}
        </Text>
      </View>
      <View style={{ alignSelf: 'stretch', gap: space.md }}>{children}</View>
      <Text size={12} style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
        Naqisni {appVersion()}
      </Text>
    </View>
  );
}

function Maintenance() {
  const { t, lang } = useApp();
  const { config, refresh } = useRemoteConfig();
  return (
    <Blocker
      icon={<Wrench size={40} color="#8CC63F" weight="duotone" />}
      title={t.maintenanceTitle}
      body={pick(config.maintenance_message, lang, t.maintenanceBody)}>
      <Button title={t.tryAgain} onPress={refresh} />
    </Blocker>
  );
}

function UpdateRequired() {
  const { t, lang } = useApp();
  const { config } = useRemoteConfig();
  const [busy, setBusy] = useState(false);
  const [noOta, setNoOta] = useState(false);
  const storeUrl = (Platform.OS === 'ios' ? config.ios_store_url : config.android_store_url) ?? (Platform.OS === 'android' ? PLAY_STORE_URL : null);

  async function update() {
    // First an over-the-air update (no store needed), then the store.
    if (Updates.isEnabled && !noOta) {
      setBusy(true);
      try {
        const check = await Updates.checkForUpdateAsync();
        if (check.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
          return;
        }
      } catch {
        // Fall through to the store.
      }
      setBusy(false);
      setNoOta(true);
    }
    if (storeUrl) Linking.openURL(storeUrl).catch(() => WebBrowser.openBrowserAsync(storeUrl));
  }

  return (
    <Blocker
      icon={<ArrowCircleUp size={40} color="#8CC63F" weight="duotone" />}
      title={t.updateTitle}
      body={pick(config.update_message, lang, t.updateBody)}>
      <Button title={busy ? t.checkingUpdate : noOta && storeUrl ? t.openStore : t.updateNow} onPress={update} loading={busy} />
    </Blocker>
  );
}

/**
 * Wraps the whole app. Maintenance and forced updates cover everything,
 * including the sign-in screen.
 */
export function AppGate({ children }: { children: ReactNode }) {
  const { config } = useRemoteConfig();
  if (Platform.OS !== 'web' && config.maintenance) return <Maintenance />;
  if (Platform.OS !== 'web' && needsUpdate(config)) return <UpdateRequired />;
  return <>{children}</>;
}

const K_BANNER = 'naqisni_banner_closed';

/** Naqisni's message at the top of the Overview. Closing it hides that message only. */
export function AppBanner() {
  const { c, t, lang } = useApp();
  const { config } = useRemoteConfig();
  const banner = config.banner;
  const text = banner ? pick(banner, lang, '') : '';
  const [closed, setClosed] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(K_BANNER).then((v) => setClosed(v ?? ''));
  }, []);

  if (!banner || !text || closed === null || closed === banner.en) return null;
  const warning = banner.tone === 'warning';
  const Icon = warning ? Warning : Megaphone;

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: warning ? c.amberSoft : c.brandSoft, borderColor: warning ? c.amber : c.brand },
      ]}
      accessibilityRole="summary">
      <Icon size={22} color={warning ? c.amber : c.brandDeep} weight="duotone" />
      <Text size={14} weight="500" style={{ flex: 1, lineHeight: 20 }}>
        {text}
      </Text>
      <Pressable
        onPress={() => {
          setClosed(banner.en);
          AsyncStorage.setItem(K_BANNER, banner.en).catch(() => undefined);
        }}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={t.closeMessage}>
        <X size={18} color={c.slate} />
      </Pressable>
    </View>
  );
}

function FeatureOff() {
  const { c, t } = useApp();
  return (
    <Centered>
      <View style={[styles.offIcon, { backgroundColor: c.hairline }]}>
        <Prohibit size={32} color={c.slate} weight="duotone" />
      </View>
      <Text weight="700" size={18} style={{ textAlign: 'center', marginTop: space.lg }}>
        {t.featureOffTitle}
      </Text>
      <Text tone="slate" style={{ textAlign: 'center', marginTop: space.sm, marginBottom: space.xl }}>
        {t.featureOffBody}
      </Text>
      <Button title={t.goBack} variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </Centered>
  );
}

/** A screen that shows "Not available" instead when Naqisni switched its feature off. */
export function gated<P extends object>(feature: Feature, Screen: ComponentType<P>) {
  function Gated(props: P) {
    const on = useFeature(feature);
    return on ? <Screen {...props} /> : <FeatureOff />;
  }
  Gated.displayName = `Gated(${feature})`;
  return Gated;
}

const styles = StyleSheet.create({
  blocker: { flex: 1, backgroundColor: '#10182B', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl },
  blockerBody: { alignItems: 'center', gap: space.md, maxWidth: 360 },
  blockerIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(140,198,63,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: space.md,
  },
  offIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
