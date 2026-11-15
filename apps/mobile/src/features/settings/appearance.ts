import { Colors, FontScale } from '@/constants/theme';
import type { Settings } from '@/foundation/contracts';

export type Appearance = {
  colors: (typeof Colors)[Settings['colorScheme']];
  fontScale: number;
  reduceMotion: boolean;
};

export function getAppearance(settings: Settings): Appearance {
  return {
    colors: Colors[settings.colorScheme],
    fontScale: FontScale[settings.textSize],
    reduceMotion: settings.reduceMotion,
  };
}
