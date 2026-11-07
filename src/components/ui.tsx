/** Small shared building blocks, styled with the Naqisni palette. */
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text as RNText,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import type { Risk } from '@/lib/stock';
import { radius, space } from '@/lib/theme';
import { useApp } from '@/providers/app-provider';

type Tone = 'ink' | 'slate' | 'brand' | 'alert' | 'amber';

/**
 * IBM Plex Sans, like naqisni.com. Plex has no Arabic letters, so Arabic
 * uses the phone's own font (which has good Arabic shapes).
 */
export function fontFor(weight: TextStyle['fontWeight'], lang: string): TextStyle {
  if (lang === 'ar') return { fontWeight: weight };
  const w = Number(weight ?? 400);
  const family = w >= 700 ? 'IBMPlexSans_700Bold' : w >= 600 ? 'IBMPlexSans_600SemiBold' : w >= 500 ? 'IBMPlexSans_500Medium' : 'IBMPlexSans_400Regular';
  return { fontFamily: family };
}

export function Text({
  tone = 'ink',
  size = 15,
  weight = '400',
  style,
  ...rest
}: TextProps & { tone?: Tone; size?: number; weight?: TextStyle['fontWeight'] }) {
  const { c, lang } = useApp();
  const color = { ink: c.ink, slate: c.slate, brand: c.brandDeep, alert: c.alert, amber: c.amber }[tone];
  return (
    <RNText
      {...rest}
      // Alignment follows the layout direction (RTL for Arabic) on its own.
      style={[{ color, fontSize: size }, fontFor(weight, lang), style]}
    />
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const { c } = useApp();
  const base = [styles.card, { backgroundColor: c.card, borderColor: c.hairline }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.7 }]}>
      {children}
    </Pressable>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: PressableProps['onPress'];
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c, lang } = useApp();
  const bg = variant === 'primary' ? c.brand : variant === 'danger' ? c.alertSoft : c.card;
  const fg = variant === 'primary' ? c.onBrand : variant === 'danger' ? c.alert : c.ink;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={(e) => {
        if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => undefined);
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: variant === 'secondary' ? c.hairline : bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : <RNText style={[{ color: fg, fontSize: 16 }, fontFor('600', lang)]}>{title}</RNText>}
    </Pressable>
  );
}

export function riskColors(risk: Risk, c: ReturnType<typeof useApp>['c']) {
  return {
    critical: { bg: c.alertSoft, fg: c.alert },
    warning: { bg: c.amberSoft, fg: c.amber },
    ordered: { bg: c.hairline, fg: c.inkSoft },
    healthy: { bg: c.brandSoft, fg: c.brandDeep },
    unset: { bg: c.hairline, fg: c.slate },
  }[risk];
}

export function RiskChip({ risk }: { risk: Risk }) {
  const { c, t, lang } = useApp();
  const label = { critical: t.reorderNow, warning: t.runningLow, ordered: t.onOrder, healthy: t.healthy, unset: t.noData }[risk];
  const { bg, fg } = riskColors(risk, c);
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <View style={[styles.dot, { backgroundColor: fg }]} />
      <RNText style={[{ color: fg, fontSize: 12 }, fontFor('600', lang)]}>{label}</RNText>
    </View>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const { c, lang } = useApp();
  return (
    <View style={[styles.segmented, { backgroundColor: c.hairline }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segment, on && { backgroundColor: c.card }]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}>
            <RNText numberOfLines={1} style={[{ color: on ? c.ink : c.slate, fontSize: 14 }, fontFor(on ? '600' : '500', lang)]}>
              {o.label}
            </RNText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Centered({ children }: { children: ReactNode }) {
  const { c } = useApp();
  return <View style={[styles.centered, { backgroundColor: c.bg }]}>{children}</View>;
}

export function Loading() {
  const { c } = useApp();
  return (
    <Centered>
      <ActivityIndicator color={c.brandDeep} />
    </Centered>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useApp();
  return (
    <Centered>
      <Text weight="600" size={17} style={{ textAlign: 'center' }}>
        {t.error}
      </Text>
      <Text tone="slate" style={{ textAlign: 'center', marginTop: space.sm, marginBottom: space.lg }}>
        {message}
      </Text>
      <Button title={t.retry} onPress={onRetry} variant="secondary" />
    </Centered>
  );
}

export function Empty({ text, icon }: { text: string; icon?: ReactNode }) {
  return (
    <View style={{ paddingVertical: space.xxl * 1.5, alignItems: 'center', gap: space.md }}>
      {icon}
      <Text tone="slate" style={{ textAlign: 'center' }}>
        {text}
      </Text>
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>;
}

export const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.lg },
  button: { minHeight: 50, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  chip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  dot: { width: 7, height: 7, borderRadius: 4 },
  segmented: { flexDirection: 'row', borderRadius: radius.md, padding: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.md - 2 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
});
