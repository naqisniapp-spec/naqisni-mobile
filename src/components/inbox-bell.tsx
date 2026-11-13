import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Bell } from '@/components/icons';
import { Text } from '@/components/ui';
import { inboxUnread } from '@/lib/inbox';
import { useLoad } from '@/lib/use-load';
import { useApp } from '@/providers/app-provider';

/** Bell on the Overview: opens the Notifications inbox, with the unread count. */
export function InboxBell() {
  const { c, t, business } = useApp();
  const { data: unread, refresh } = useLoad(inboxUnread, business?.id ?? '');

  // A new message from Naqisni while the app is open: update the count.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationReceivedListener((n) => {
      if (typeof n.request.content.data?.campaign === 'string') refresh();
    });
    // Back to the app after a while (a message may have come in meanwhile).
    const app = AppState.addEventListener('change', (st) => {
      if (st === 'active') refresh();
    });
    return () => {
      sub.remove();
      app.remove();
    };
  }, [refresh]);

  const n = unread ?? 0;

  // The same number on the app icon (where the phone's launcher shows it).
  useEffect(() => {
    if (Platform.OS === 'web' || unread === null) return;
    Notifications.setBadgeCountAsync(n).catch(() => undefined);
  }, [n, unread]);
  return (
    <Pressable
      onPress={() => router.push('/inbox')}
      hitSlop={8}
      style={({ pressed }) => [styles.btn, { backgroundColor: c.card, borderColor: c.hairline }, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel={t.inboxOpen(n)}>
      <Bell size={20} color={c.ink} weight={n ? 'fill' : 'regular'} />
      {n > 0 && (
        <View style={[styles.badge, { backgroundColor: c.alert, borderColor: c.bg }]}>
          <Text size={11} weight="700" style={{ color: '#FFFFFF', lineHeight: 14 }}>
            {n > 9 ? '9+' : n}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { width: 40, height: 40, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -6,
    end: -6,
    minWidth: 21,
    height: 21,
    paddingHorizontal: 5,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
