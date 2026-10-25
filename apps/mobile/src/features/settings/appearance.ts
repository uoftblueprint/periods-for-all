import { Colors, FontScale } from '@/constants/theme';
import type { Settings } from '@/foundation/contracts';

export type Appearance = {
  colors: typeof Colors.light;
  fontScale: number;
  reduceMotion: boolean;
};

// Maps saved preferences to visual styles. Screens apply these values; this only describes them.
export function getAppearance(settings: Settings): Appearance {
  return {
    colors: Colors[settings.colorScheme],
    fontScale: FontScale[settings.textSize],
    reduceMotion: settings.reduceMotion,
  };
}
