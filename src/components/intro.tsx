/**
 * The opening moment: the Naqisni logo fades and scales in on brand navy while
 * stock boxes drift behind it, then the whole thing fades away to the app.
 * It sits on top of the app, so the app loads underneath while it plays.
 */
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';

import { palette } from '@/lib/theme';

const NAVY = palette.light.ink;
/** The shortest time the intro stays up, so the logo is always seen landing. */
const MIN_MS = 1900;
const FADE_OUT_MS = 380;

type Box = {
  /** Position as a share of the screen (0–1). */
  x: number;
  y: number;
  size: number;
  tilt: number;
  color: string;
  opacity: number;
  /** How far it drifts, in points, and how long one way takes. */
  dx: number;
  dy: number;
  ms: number;
};

const SOFT = palette.light.inkSoft; // #1E293B
const LINE = palette.dark.hairline; // #243049
const GREEN = palette.light.brand; // #8CC63F

// Laid out to leave the middle of the screen clear for the logo.
const BOXES: Box[] = [
  { x: 0.08, y: 0.07, size: 50, tilt: -12, color: SOFT, opacity: 1, dx: 10, dy: 22, ms: 5200 },
  { x: 0.39, y: 0.05, size: 30, tilt: 18, color: LINE, opacity: 1, dx: -8, dy: 16, ms: 4300 },
  { x: 0.72, y: 0.09, size: 62, tilt: 10, color: SOFT, opacity: 1, dx: -12, dy: 20, ms: 6100 },
  { x: 0.57, y: 0.21, size: 36, tilt: -20, color: GREEN, opacity: 0.22, dx: 9, dy: -18, ms: 4700 },
  { x: 0.19, y: 0.22, size: 42, tilt: 25, color: LINE, opacity: 1, dx: 12, dy: 14, ms: 5600 },
  { x: -0.03, y: 0.33, size: 56, tilt: 8, color: SOFT, opacity: 1, dx: 14, dy: -16, ms: 6400 },
  { x: 0.86, y: 0.32, size: 46, tilt: -15, color: LINE, opacity: 1, dx: -10, dy: 18, ms: 5000 },
  { x: 0.04, y: 0.53, size: 32, tilt: -25, color: GREEN, opacity: 0.16, dx: 8, dy: -14, ms: 4500 },
  { x: 0.89, y: 0.53, size: 30, tilt: 20, color: SOFT, opacity: 1, dx: -8, dy: 15, ms: 4900 },
  { x: 0.11, y: 0.68, size: 60, tilt: 14, color: SOFT, opacity: 1, dx: 12, dy: -20, ms: 6000 },
  { x: 0.44, y: 0.67, size: 32, tilt: -10, color: LINE, opacity: 1, dx: -9, dy: -15, ms: 4400 },
  { x: 0.7, y: 0.69, size: 50, tilt: -22, color: GREEN, opacity: 0.2, dx: -11, dy: 17, ms: 5300 },
  { x: 0.28, y: 0.83, size: 40, tilt: 30, color: LINE, opacity: 1, dx: 10, dy: -18, ms: 4800 },
  { x: 0.57, y: 0.85, size: 66, tilt: -8, color: SOFT, opacity: 1, dx: -13, dy: -22, ms: 6300 },
  { x: 0.83, y: 0.81, size: 36, tilt: 16, color: LINE, opacity: 1, dx: -8, dy: -14, ms: 4600 },
  { x: 0.03, y: 0.89, size: 46, tilt: -18, color: SOFT, opacity: 1, dx: 11, dy: -16, ms: 5500 },
];

/** One parcel: a rounded square with a notch of "tape" at the top. */
function DriftingBox({ box, width, height, still }: { box: Box; width: number; height: number; still: boolean }) {
  const [drift] = useState(() => new Animated.Value(0));
  const [appear] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const show = Animated.timing(appear, { toValue: 1, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true });
    show.start();
    if (still) return () => show.stop();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: box.ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: box.ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => {
      show.stop();
      loop.stop();
    };
  }, [appear, drift, box.ms, still]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: box.x * width,
        top: box.y * height,
        width: box.size,
        height: box.size,
        borderRadius: box.size * 0.14,
        backgroundColor: box.color,
        alignItems: 'center',
        opacity: appear.interpolate({ inputRange: [0, 1], outputRange: [0, box.opacity] }),
        transform: [
          { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, box.dx] }) },
          { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, box.dy] }) },
          { rotate: drift.interpolate({ inputRange: [0, 1], outputRange: [`${box.tilt}deg`, `${box.tilt + 7}deg`] }) },
        ],
      }}>
      <View style={{ width: box.size * 0.2, height: box.size * 0.26, backgroundColor: NAVY }} />
    </Animated.View>
  );
}

/**
 * @param appReady the app underneath is ready to be shown
 * @param onShown the intro has drawn its first frame (safe to hide the native splash)
 * @param onDone the intro has faded out and can be removed
 */
export function Intro({ appReady, onShown, onDone }: { appReady: boolean; onShown: () => void; onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const [logo] = useState(() => new Animated.Value(0));
  const [out] = useState(() => new Animated.Value(1));
  const [minPassed, setMinPassed] = useState(false);
  const [still, setStill] = useState(false);

  // People who turned on "Reduce motion" get the logo fade without the drifting.
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setStill)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const land = Animated.timing(logo, { toValue: 1, duration: 800, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    land.start();
    const timer = setTimeout(() => setMinPassed(true), MIN_MS);
    return () => {
      land.stop();
      clearTimeout(timer);
    };
  }, [logo]);

  useEffect(() => {
    if (!appReady || !minPassed) return;
    const leave = Animated.timing(out, { toValue: 0, duration: FADE_OUT_MS, easing: Easing.in(Easing.quad), useNativeDriver: true });
    leave.start(({ finished }) => {
      if (finished) onDone();
    });
    return () => leave.stop();
  }, [appReady, minPassed, out, onDone]);

  const logoWidth = Math.min(width * 0.58, 300);
  return (
    <Animated.View
      onLayout={onShown}
      pointerEvents="auto"
      accessible
      accessibilityRole="image"
      accessibilityLabel="Naqisni"
      style={[StyleSheet.absoluteFill, styles.wrap, { opacity: out }]}>
      {BOXES.map((b, i) => (
        <DriftingBox key={i} box={b} width={width} height={height} still={still} />
      ))}
      <Animated.View
        style={{
          opacity: logo,
          transform: [
            { scale: logo.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) },
            { translateY: logo.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
          ],
        }}>
        <Image
          source={require('@/assets/images/logo-wordmark.png')}
          style={{ width: logoWidth, height: Math.round(logoWidth * 0.36) }}
          contentFit="contain"
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', zIndex: 10 },
});
