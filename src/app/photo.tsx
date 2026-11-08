import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Centered, Text } from '@/components/ui';
import { deliver, stopWaiting } from '@/lib/picker';
import { radius, space } from '@/lib/theme';
import { useApp } from '@/providers/app-provider';

/** Take a product photo and hand it back to the product form. */
export default function PhotoScreen() {
  const { t } = useApp();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    stopWaiting('photo');
    router.back();
  }

  async function take() {
    if (!camera.current || busy) return;
    setBusy(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      // A modest JPEG keeps the upload well under the 5 MB limit.
      const pic = await camera.current.takePictureAsync({ quality: 0.5, shutterSound: false });
      if (pic?.uri) setShot(pic.uri);
    } finally {
      setBusy(false);
    }
  }

  function use() {
    if (!shot) return;
    deliver('photo', shot);
    router.back();
  }

  if (!permission) return <Centered>{null}</Centered>;
  if (!permission.granted)
    return (
      <Centered>
        <Text style={{ textAlign: 'center', marginBottom: space.lg }}>{t.cameraPermissionPhoto}</Text>
        <Button title={t.allowCamera} onPress={requestPermission} />
        <Button title={t.close} variant="secondary" onPress={close} style={{ marginTop: space.md }} />
      </Centered>
    );

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {shot ? (
        <Image source={shot} style={StyleSheet.absoluteFill} contentFit="contain" />
      ) : (
        <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" mode="picture" />
      )}

      <Pressable onPress={close} style={[styles.close, { top: insets.top + space.md }]} hitSlop={12}>
        <Text weight="700" style={{ color: '#fff' }}>
          {t.close}
        </Text>
      </Pressable>

      <View style={[styles.bar, { paddingBottom: insets.bottom + space.xl }]}>
        {shot ? (
          <View style={{ flexDirection: 'row', gap: space.md, alignSelf: 'stretch' }}>
            <Button title={t.retake} variant="secondary" onPress={() => setShot(null)} style={{ flex: 1 }} />
            <Button title={t.usePhoto} onPress={use} style={{ flex: 1 }} />
          </View>
        ) : (
          <Pressable
            onPress={take}
            accessibilityRole="button"
            accessibilityLabel={t.takePhoto}
            style={({ pressed }) => [styles.shutter, pressed && { opacity: 0.7 }]}>
            {busy ? <ActivityIndicator color="#10182B" /> : <View style={styles.shutterInner} />}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  close: { position: 'absolute', start: space.lg, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.xl, paddingTop: space.lg, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  shutter: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 62, height: 62, borderRadius: 31, borderWidth: 2, borderColor: '#10182B' },
});
