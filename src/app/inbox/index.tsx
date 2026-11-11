import { router, Stack } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Bell } from '@/components/icons';
import { Empty, ErrorState, Loading, panel, Text } from '@/components/ui';
import { loadInbox, markInboxRead, messageBody, messageTitle } from '@/lib/inbox';
import { shortWhen } from '@/lib/support';
import { radius, space } from '@/lib/theme';
import { useLoad } from '@/lib/use-load';
import { useApp } from '@/providers/app-provider';

/** Every message Naqisni sent to this customer, newest first. */
export default function InboxScreen() {
  const { c, t, lang, business } = useApp();
  const { data, error, loading, refreshing, refresh } = useLoad(loadInbox, business?.id ?? '');

  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? ''} onRetry={refresh} />;
  const unread = data.filter((m) => !m.read).length;

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: unread
            ? () => (
                <Text tone="brand" weight="600" onPress={() => markInboxRead().then(refresh)} accessibilityRole="button">
                  {t.inboxMarkAll}
                </Text>
              )
            : undefined,
        }}
      />
      <ScrollView
        contentContainerStyle={[panel(c), { gap: space.lg, marginBottom: space.xxl * 2 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.brandDeep} />}>
        {data.length === 0 ? (
          <View style={{ alignItems: 'center' }}>
            <Empty
              icon={
                <View style={[styles.emptyIcon, { backgroundColor: c.brandSoft }]}>
                  <Bell size={30} color={c.brandDeep} weight="duotone" />
                </View>
              }
              text={t.inboxEmptyBody}
            />
          </View>
        ) : (
          <View style={[styles.list, { backgroundColor: c.card, borderColor: c.hairline }]}>
            {data.map((m, i) => (
              <Pressable
                key={m.id}
                onPress={() => router.push({ pathname: '/inbox/[id]', params: { id: m.id } })}
                style={({ pressed }) => [
                  styles.item,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline },
                  pressed && { backgroundColor: c.hairline },
                ]}
                accessibilityRole="button">
                <View style={[styles.dot, { backgroundColor: m.read ? 'transparent' : c.brandDeep }]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={styles.top}>
                    <Text weight={m.read ? '600' : '700'} numberOfLines={1} style={{ flex: 1 }}>
                      {messageTitle(m, lang)}
                    </Text>
                    <Text tone="slate" size={12}>
                      {shortWhen(m.created_at, lang)}
                    </Text>
                  </View>
                  <Text tone="slate" size={14} numberOfLines={2}>
                    {messageBody(m, lang)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  list: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, padding: space.lg },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 7 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
