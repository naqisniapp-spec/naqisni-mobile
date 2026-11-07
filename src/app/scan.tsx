import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Centered, Text } from '@/components/ui';
import { findByBarcode } from '@/lib/data';
import { radius, space } from '@/lib/theme';
import { useApp } from '@/providers/app-provider';

/** Scan a barcode (or SKU QR) and open that product. */
export default function ScanScreen() {
  const { t, business } = useApp();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [notice, setNotice] = useState<string | null>(null);
  const busy = useRef(false);
  const last = useRef<string | null>(null);

  async function onScan({ data }: BarcodeScanningResult) {
    if (busy.current || !business || data === last.current) return;
    busy.current = true;
    last.current = data;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    const id = await findByBarcode(business.id, data.trim());
    if (id) {
      router.replace({ pathname: '/product/[id]', params: { id } });
      return;
    }
    setNotice(t.notFound(data));
    busy.current = false;
    // Allow the same code again after a moment.
    setTimeout(() => (last.current = null), 2500);
  }

  if (!permission) return <Centered>{null}</Centered>;
  if (!permission.granted)
    return (
      <Centered>
        <Text style={{ textAlign: 'center', marginBottom: space.lg }}>{t.cameraPermission}</Text>
        <Button title={t.allowCamera} onPress={requestPermission} />
        <Button title={t.close} variant="secondary" onPress={() => router.back()} style={{ marginTop: space.md }} />
      </Centered>
    );

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'] }}
        onBarcodeScanned={onScan}
      />
      <View style={styles.frameWrap} pointerEvents="none">
        <View style={styles.frame} />
      </View>
      <Pressable onPress={() => router.back()} style={[styles.close, { top: insets.top + space.md }]} hitSlop={12}>
        <Text weight="700" style={{ color: '#fff' }}>
          {t.close}
        </Text>
      </Pressable>
      {notice && (
        <View style={[styles.notice, { bottom: insets.bottom + space.xxl }]}>
          <Text style={{ color: '#fff', textAlign: 'center' }}>{notice}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frameWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 260, height: 170, borderRadius: radius.lg, borderWidth: 3, borderColor: '#8CC63F' },
  close: { position: 'absolute', start: space.lg, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  notice: { position: 'absolute', left: space.xl, right: space.xl, backgroundColor: 'rgba(0,0,0,0.7)', padding: space.lg, borderRadius: radius.lg },
});
