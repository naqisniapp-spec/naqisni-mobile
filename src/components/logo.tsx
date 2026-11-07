import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '@/components/ui';

/**
 * The Naqisni wordmark (cropped from naqisni-web public/logo.png) with ™,
 * like the website's <Logo>. Made for dark backgrounds.
 */
export function Logo({ width = 120 }: { width?: number }) {
  const height = Math.round(width * 0.36);
  const tm = Math.max(8, Math.round(width * 0.085));
  return (
    <View style={{ width: width + tm, height, flexDirection: 'row' }} accessible accessibilityRole="image" accessibilityLabel="Naqisni">
      <Image source={require('@/assets/images/logo-wordmark.png')} style={{ width, height }} contentFit="contain" />
      <Text weight="600" style={{ fontSize: tm, lineHeight: tm + 2, color: '#8CC63F', marginTop: Math.round(height * 0.13), marginStart: -2 }}>
        ™
      </Text>
    </View>
  );
}
