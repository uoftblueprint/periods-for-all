import type { Appearance } from '@/features/settings/appearance';

export type TaskUIColors = {
  surface: string;
  field: string;
  text: string;
  secondaryText: string;
  border: string;
  selectedBorder: string;
  selectedFill: string;
  error: string;
  disabled: string;
};

export function getTaskUIColors(appearance: Appearance): TaskUIColors {
  const highContrast = appearance.colors.background === '#FFFFFF';
  const dark = appearance.colors.background === '#000000';
  return {
    surface: appearance.colors.background,
    field: appearance.colors.backgroundElement,
    text: appearance.colors.text,
    secondaryText: appearance.colors.textSecondary,
    border: highContrast ? appearance.colors.text : (dark ? '#666666' : '#B9AB95'),
    selectedBorder: highContrast ? appearance.colors.text : (dark ? '#FFFFFF' : '#A90D02'),
    selectedFill: appearance.colors.backgroundSelected,
    error: dark ? '#FF8A84' : '#A90D02',
    disabled: dark ? '#777777' : '#8A8174',
  };
}
