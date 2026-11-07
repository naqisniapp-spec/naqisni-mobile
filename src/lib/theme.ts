import { Platform } from 'react-native';

/** Naqisni brand colours — the same values as naqisni-web src/app/globals.css. */
export const palette = {
  light: {
    bg: '#F5F6F4',
    card: '#FFFFFF',
    ink: '#10182B',
    inkSoft: '#1E293B',
    slate: '#5B6472',
    hairline: '#E4E6E0',
    brand: '#8CC63F',
    brandDeep: '#5C8F26',
    brandSoft: '#F0F7E3',
    amber: '#D97B0A',
    amberSoft: '#FBF0E0',
    alert: '#C14343',
    alertSoft: '#FBEAEA',
    onBrand: '#10182B',
  },
  dark: {
    bg: '#0B111E',
    card: '#131B2C',
    ink: '#F1F3EF',
    inkSoft: '#D5DAE2',
    slate: '#98A1AF',
    hairline: '#243049',
    brand: '#8CC63F',
    brandDeep: '#A5D865',
    brandSoft: '#1D2A14',
    amber: '#F0A13A',
    amberSoft: '#2E2213',
    alert: '#E06A6A',
    alertSoft: '#331A1C',
    onBrand: '#10182B',
  },
};

export type Colors = typeof palette.light;

export const radius = { sm: 6, md: 10, lg: 16, pill: 999 };
/** On the web the tab bar floats at the top of the page; leave room under it. Phones: 0 (tab bar is at the bottom). */
export const topBarSpace = Platform.OS === 'web' ? 76 : 0;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
