import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { supabase, WEB_URL } from '@/lib/supabase';
import { radius, space } from '@/lib/theme';
import { useApp } from '@/providers/app-provider';

export default function SignIn() {
  const { c, t, lang, setLang } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'alert' | 'brand'; text: string } | null>(null);

  async function signIn() {
    setMessage(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setMessage({ tone: 'alert', text: error.message.includes('Invalid') ? t.wrongLogin : error.message });
  }

  async function forgot() {
    if (!email.trim()) return setMessage({ tone: 'alert', text: t.enterEmailFirst });
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${WEB_URL}/auth/recovery` });
    setMessage(error ? { tone: 'alert', text: error.message } : { tone: 'brand', text: t.resetSent });
  }

  const input = [styles.input, { backgroundColor: c.card, borderColor: c.hairline, color: c.ink }];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => setLang(lang === 'ar' ? 'en' : 'ar')} style={styles.lang} hitSlop={12}>
            <Text tone="slate" weight="600">
              {lang === 'ar' ? 'English' : 'العربية'}
            </Text>
          </Pressable>

          <View style={{ marginBottom: space.xxl }}>
            <View style={[styles.mark, { backgroundColor: c.ink }]}>
              <Text size={30} weight="800" style={{ color: c.brand }}>
                n
              </Text>
            </View>
            <Text size={34} weight="800" style={{ letterSpacing: -0.5 }}>
              naqisni
            </Text>
            <Text tone="slate" size={16}>
              {t.appTagline}
            </Text>
          </View>

          <Text tone="slate" size={13} weight="600" style={styles.label}>
            {t.email}
          </Text>
          <TextInput
            style={input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholderTextColor={c.slate}
            returnKeyType="next"
          />

          <Text tone="slate" size={13} weight="600" style={styles.label}>
            {t.password}
          </Text>
          <TextInput
            style={input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={signIn}
          />

          {message && (
            <Text tone={message.tone} style={{ marginTop: space.md }}>
              {message.text}
            </Text>
          )}

          <Button title={busy ? t.signingIn : t.signIn} onPress={signIn} loading={busy} disabled={!email || !password} style={{ marginTop: space.xl }} />

          <Pressable onPress={forgot} style={{ marginTop: space.lg, alignSelf: 'center' }} hitSlop={8}>
            <Text tone="brand" weight="600">
              {t.forgotPassword}
            </Text>
          </Pressable>
          <Pressable onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/signup`)} style={{ marginTop: space.md, alignSelf: 'center' }} hitSlop={8}>
            <Text tone="slate">{t.noAccount}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: 'center', padding: space.xl, maxWidth: 480, width: '100%', alignSelf: 'center' },
  lang: { position: 'absolute', top: space.lg, end: space.xl },
  mark: { width: 56, height: 56, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: space.lg },
  label: { marginBottom: 6, marginTop: space.lg },
  input: { minHeight: 50, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.lg, fontSize: 16 },
});
