import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Sparkle } from '@/components/icons';
import { Text } from '@/components/ui';
import { AiAnswer } from '@/components/ai-answer';
import { askNaqisni, type ChatMessage } from '@/lib/ai';
import { radius, space } from '@/lib/theme';
import { useApp } from '@/providers/app-provider';

type Msg = ChatMessage & { error?: boolean };

/**
 * Ask Naqisni: a conversation about the business's stock, answered by AI from
 * its own data. Used by the Ask AI tab (embedded, no header above it) and by
 * the /ask screen.
 */
export function AskChat({ embedded = false }: { embedded?: boolean }) {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const { c, t, lang } = useApp();
  const insets = useSafeAreaInsets();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const list = useRef<FlatList<Msg>>(null);
  const askedFirst = useRef(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // Keep the question box above the keyboard on Android too (the app runs
  // edge-to-edge, so the window no longer resizes for the keyboard by itself).
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardOpen(true);
      list.current?.scrollToEnd({ animated: true });
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  async function ask(question: string) {
    const qq = question.trim();
    if (!qq || busy) return;
    const next: Msg[] = [...msgs.filter((m) => !m.error), { role: 'user', content: qq }];
    setMsgs(next);
    setText('');
    setBusy(true);
    try {
      const res = await askNaqisni(next.map(({ role, content }) => ({ role, content })), lang);
      setMsgs((m) => [...m, { role: 'assistant', content: res.answer }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: 'assistant', content: e instanceof Error ? e.message : t.error, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  // A suggestion tapped on the Overview is asked straight away (once).
  const askRef = useRef(ask);
  useEffect(() => {
    askRef.current = ask;
  });
  useEffect(() => {
    if (q && !askedFirst.current) {
      askedFirst.current = true;
      askRef.current(q);
    }
  }, [q]);

  return (
    <>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={embedded ? 0 : insets.top + (Platform.OS === 'ios' ? 44 : 56)}>
        <FlatList
          ref={list}
          data={msgs}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: space.lg, gap: space.md, flexGrow: 1 }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={{ gap: space.md, paddingTop: space.xl }}>
              <View style={styles.icon}>
                <Sparkle size={26} color={c.brand} weight="fill" />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Text size={20} weight="700">
                  {t.askAssistant}
                </Text>
                <View style={[styles.ai, { backgroundColor: c.brand }]}>
                  <Text size={11} weight="700" style={{ color: c.onBrand }}>
                    AI
                  </Text>
                </View>
              </View>
              <Text tone="slate">{t.askIntro}</Text>
              <View style={{ gap: space.sm, marginTop: space.sm }}>
                {t.askSuggestions.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => ask(s)}
                    style={({ pressed }) => [styles.suggestion, { borderColor: c.hairline, backgroundColor: c.card }, pressed && { opacity: 0.7 }]}>
                    <Text>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          }
          renderItem={({ item: m }) =>
            m.role === 'user' ? (
              <View style={[styles.bubble, styles.mine, { backgroundColor: '#10182B' }]}>
                <Text style={{ color: '#FFFFFF' }}>{m.content}</Text>
              </View>
            ) : m.error ? (
              <View style={[styles.bubble, styles.theirs, { backgroundColor: c.alertSoft, borderColor: c.hairline }]}>
                <Text tone="alert" style={{ lineHeight: 22 }}>
                  {m.content}
                </Text>
              </View>
            ) : (
              <AiAnswer text={m.content} />
            )
          }
          ListFooterComponent={
            busy ? (
              <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
                <ActivityIndicator color={c.brandDeep} />
                <Text tone="slate">{t.askLooking}</Text>
              </View>
            ) : msgs.length ? (
              <Text tone="slate" size={12} style={{ textAlign: 'center', marginTop: space.sm }}>
                {t.askDisclaimer}
              </Text>
            ) : undefined
          }
        />
        <View style={[styles.inputRow, { borderTopColor: c.hairline, backgroundColor: c.bg, paddingBottom: keyboardOpen ? space.sm : Math.max(insets.bottom, space.md) }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={msgs.length ? t.askFollowUp : t.askPlaceholder}
            placeholderTextColor={c.slate}
            maxLength={1500}
            multiline
            style={[styles.input, { backgroundColor: c.card, borderColor: c.hairline, color: c.ink }]}
          />
          <Pressable
            onPress={() => ask(text)}
            disabled={busy || !text.trim()}
            accessibilityRole="button"
            accessibilityLabel={t.send}
            style={({ pressed }) => [styles.send, { backgroundColor: c.brand, opacity: busy || !text.trim() ? 0.5 : pressed ? 0.8 : 1 }]}>
            <Text weight="700" style={{ color: c.onBrand }}>
              {t.askSend}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  icon: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#10182B', alignItems: 'center', justifyContent: 'center' },
  ai: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill },
  suggestion: { padding: space.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  bubble: { maxWidth: '88%', paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.lg },
  mine: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: StyleSheet.hairlineWidth },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, paddingHorizontal: space.md, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: 46, maxHeight: 120, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingTop: 12, fontSize: 16 },
  send: { minHeight: 46, paddingHorizontal: space.lg, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
