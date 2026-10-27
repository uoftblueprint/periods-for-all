
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

  // Verify the initial selection
  expect(
    screen.getByRole('radio', { name: 'Default' })
      .props.accessibilityState.checked
  ).toBe(true);

  expect(
    screen.getByRole('radio', { name: 'Dark Mode' })
      .props.accessibilityState.checked
  ).toBe(false);

  // Press Dark Mode
  fireEvent.press(screen.getByRole('radio', { name: 'Dark Mode' }));

  // Verify the callback receives the correct value
  expect(onChange).toHaveBeenCalledTimes(1);
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

  // Verify the selected state updates
  expect(
    screen.getByRole('radio', { name: 'Dark Mode' })
      .props.accessibilityState.checked
  ).toBe(true);

  expect(
    screen.getByRole('radio', { name: 'Default' })
      .props.accessibilityState.checked
  ).toBe(false);
});
