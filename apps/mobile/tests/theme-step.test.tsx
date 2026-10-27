import { expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeStep } from '@/features/onboarding/theme-step';
import { defaultSettings } from '@/foundation/contracts';
import { getAppearance } from '@/features/settings/appearance';

test('theme selection updates correctly', () => {
  const onChange = jest.fn();

  const { rerender } = render(
    <ThemeStep
      value="light"
      onChange={onChange}
      appearance={getAppearance(defaultSettings)}
    />
  );

  // Press Dark Mode
  fireEvent.press(screen.getByRole('radio', { name: 'Dark Mode' }));

  // Verify callback
  expect(onChange).toHaveBeenCalledWith('dark');

  // Simulate the parent updating its state
  rerender(
    <ThemeStep
      value="dark"
      onChange={onChange}
      appearance={getAppearance({
        ...defaultSettings,
        colorScheme: 'dark',
      })}
    />
  );

  // Verify accessibility selection state
  expect(
    screen.getByRole('radio', { name: 'Dark Mode' })
  ).toHaveAccessibilityState({ checked: true });

  expect(
    screen.getByRole('radio', { name: 'Default' })
  ).toHaveAccessibilityState({ checked: false });
});