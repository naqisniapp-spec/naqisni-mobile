import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Globe } from '@/components/icons';
import { Logo } from '@/components/logo';
import { Button, fontFor, Text } from '@/components/ui';
import { supabase, WEB_URL } from '@/lib/supabase';
import { palette, radius, space } from '@/lib/theme';
import { useApp } from '@/providers/app-provider';

const INK = palette.light.ink;

export default function SignIn() {
  const { c, t, lang, setLang } = useApp();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState<'email' | 'password' | null>(null);
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

  const input = (name: 'email' | 'password') => [
    styles.input,
    fontFor('400', lang),
    { backgroundColor: c.bg, borderColor: focus === name ? c.brand : c.hairline, color: c.ink },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: INK }}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xl }]} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => setLang(lang === 'ar' ? 'en' : 'ar')} style={styles.lang} hitSlop={12} accessibilityRole="button">
            <Globe size={16} color="rgba(255,255,255,0.8)" />
            <Text weight="600" size={14} style={{ color: 'rgba(255,255,255,0.8)' }}>
              {lang === 'ar' ? 'English' : 'العربية'}
            </Text>
          </Pressable>

          <View style={styles.brand}>
            <Logo width={190} />
            <Text size={16} style={{ color: 'rgba(255,255,255,0.65)', marginTop: space.md, textAlign: 'center' }}>
              {t.appTagline}
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: c.card }]}>
            <Text size={22} weight="700">
              {t.signIn}
            </Text>

            <Text tone="slate" size={13} weight="600" style={styles.label}>
              {t.email}
            </Text>
            <TextInput
              style={input('email')}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocus('email')}
              onBlur={() => setFocus(null)}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
            />

            <Text tone="slate" size={13} weight="600" style={styles.label}>
              {t.password}
            </Text>
            <TextInput
              style={input('password')}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocus('password')}
              onBlur={() => setFocus(null)}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={signIn}
            />

            <Pressable onPress={forgot} style={{ alignSelf: 'flex-end', marginTop: space.sm }} hitSlop={8}>
              <Text tone="brand" weight="600" size={14}>
                {t.forgotPassword}
              </Text>
            </Pressable>

            {message && (
              <Text tone={message.tone} size={14} style={{ marginTop: space.md }}>
                {message.text}
              </Text>
            )}

            <Button title={busy ? t.signingIn : t.signIn} onPress={signIn} loading={busy} disabled={!email || !password} style={{ marginTop: space.lg }} />
          </View>

          <Pressable onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/signup`)} style={{ marginTop: space.xl, alignSelf: 'center' }} hitSlop={8}>
            <Text size={14} style={{ color: 'rgba(255,255,255,0.7)' }}>
              {t.noAccount}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: space.xl, maxWidth: 480, width: '100%', alignSelf: 'center' },
  lang: { position: 'absolute', top: space.xl + 24, end: space.xl, flexDirection: 'row', alignItems: 'center', gap: 6, zIndex: 1 },
  brand: { alignItems: 'center', marginBottom: space.xxl },
  card: { borderRadius: 24, padding: space.xl },
  label: { marginBottom: 6, marginTop: space.lg },
  input: { minHeight: 52, borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: space.lg, fontSize: 16 },
});
