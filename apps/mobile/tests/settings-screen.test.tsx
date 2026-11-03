import { expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SettingsScreen } from '@/features/settings/settings-screen';
import { colorSchemes, textSizes, type Settings } from '@/foundation/contracts';

const fontLabels = ['Standard', 'Large', 'Extra large', 'Largest'];
const themeLabels = ['Default', 'Dark Mode', 'High Contrast'];

test.each(textSizes.flatMap((textSize) => colorSchemes.map((colorScheme) => ({ textSize, colorScheme }))))(
  'settings represents saved $textSize/$colorScheme and each control preserves other preferences',
  ({ textSize, colorScheme }) => {
    const settings: Settings = Object.freeze({ textSize, colorScheme, reduceMotion: true });
    const onChange = jest.fn();
    const result = render(<SettingsScreen settings={settings} onChange={onChange} />);
    expect(screen.getByRole('radio', { name: new RegExp(`^(✓ )?${fontLabels[textSizes.indexOf(textSize)]}$`) })).toBeChecked();
    expect(screen.getByRole('radio', { name: new RegExp(`^(✓ )?${themeLabels[colorSchemes.indexOf(colorScheme)]}$`) })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Reduce motion' })).toHaveProp('value', true);

    fontLabels.forEach((label, index) => {
      fireEvent.press(screen.getByRole('radio', { name: new RegExp(`^(✓ )?${label}$`) }));
      expect(onChange).toHaveBeenLastCalledWith({ ...settings, textSize: textSizes[index] });
    });
    themeLabels.forEach((label, index) => {
      fireEvent.press(screen.getByRole('radio', { name: new RegExp(`^(✓ )?${label}$`) }));
      expect(onChange).toHaveBeenLastCalledWith({ ...settings, colorScheme: colorSchemes[index] });
    });
    fireEvent(screen.getByRole('switch', { name: 'Reduce motion' }), 'valueChange', false);
    expect(onChange).toHaveBeenLastCalledWith({ ...settings, reduceMotion: false });

    result.rerender(<SettingsScreen settings={{ ...settings, textSize: 'largest', colorScheme: 'highContrast' }} onChange={onChange} />);
    expect(screen.getByRole('radio', { name: /Largest/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /High Contrast/ })).toBeChecked();
    expect(settings).toEqual({ textSize, colorScheme, reduceMotion: true });
  },
);
