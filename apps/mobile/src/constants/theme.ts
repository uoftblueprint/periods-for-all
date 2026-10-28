import '@/global.css';

import { Platform } from 'react-native';

import type { Settings } from '@/foundation/contracts';

type Palette = Readonly<
  Record<'text' | 'background' | 'backgroundElement' | 'backgroundSelected' | 'textSecondary', string>
>;

export const Colors: Readonly<Record<Settings['colorScheme'], Palette>> = {
  light: {
    text: '#31281B',
    background: '#FCFBF8',
    backgroundElement: '#F9F4EC',
    backgroundSelected: '#FEE4E2',
    textSecondary: '#5A482F',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
  // Provisional palette for the internal high-contrast preview; it has not been audited.
  highContrast: {
    text: '#000000',
    background: '#FFFFFF',
    backgroundElement: '#E6E6E6',
    backgroundSelected: '#BDEFFF',
    textSecondary: '#1A1A1A',
  },
};

export const OnboardingColors = {
  brand: '#A90D02',
  brandPressed: '#7D1912',
  brandSoft: '#FEE4E2',
  border: '#F2EADE',
  inactiveTrack: '#E4E4E2',
  progressInactive: '#B9AB95',
  white: '#FFFFFF',
  darkPreview: '#25251F',
  darkPreviewSurface: '#91918C',
} as const;

export const OnboardingFonts = {
  regular: 'AtkinsonHyperlegible_400Regular',
  bold: 'AtkinsonHyperlegible_700Bold',
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const FontScale: Readonly<Record<Settings['textSize'], number>> = {
  standard: 1,
  large: 1.25,
  extraLarge: 1.5,
  largest: 1.75,
};

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
