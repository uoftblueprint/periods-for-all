
import { expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import ThemePreview from '@/app/theme-preview';
import { ThemeStep } from '@/features/onboarding/theme-step';
import { defaultSettings } from '@/foundation/contracts';
import { getAppearance } from '@/features/settings/appearance';

const mockRouter = {
  canGoBack: jest.fn(() => true),
  back: jest.fn(),
  replace: jest.fn(),
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  Stack: { Screen: () => null },
}));

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
    screen.getByRole('radio', { name: 'Default', checked: true })
      .props.accessibilityState.checked
  ).toBe(true);

  expect(
    screen.getByRole('radio', { name: 'Dark Mode', checked: false })
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
    screen.getByRole('radio', { name: 'Dark Mode', checked: true })
      .props.accessibilityState.checked
  ).toBe(true);

  expect(
    screen.getByRole('radio', { name: 'Default', checked: false })
      .props.accessibilityState.checked
  ).toBe(false);

  fireEvent.press(screen.getByRole('radio', { name: 'Default' }));
  expect(onChange).toHaveBeenLastCalledWith('light');
});

test('theme step only shows supported theme choices with large text', () => {
  render(
    <ThemeStep
      value="dark"
      onChange={jest.fn()}
      appearance={getAppearance({ ...defaultSettings, colorScheme: 'dark', textSize: 'large' })}
    />
  );

  expect(screen.getAllByRole('radio')).toHaveLength(2);
  expect(screen.queryByRole('radio', { name: 'High Contrast' })).toBeNull();
  expect(screen.queryAllByRole('button')).toHaveLength(0);
  expect(screen.queryByRole('header')).toBeNull();
});

test('preview owns theme state and onboarding navigation', () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

  try {
    render(<ThemePreview />);

    fireEvent.press(screen.getByRole('radio', { name: 'Dark Mode' }));
    expect(screen.getByRole('radio', { name: 'Dark Mode', checked: true })).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Go back' }));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('button', { name: 'Continue to Period Information' }));
    expect(alert).toHaveBeenCalledWith('Theme selected', 'Period Information is not connected in this preview yet.');

    fireEvent.press(screen.getByRole('button', { name: 'Skip for now' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/');

    mockRouter.canGoBack.mockReturnValue(false);
    fireEvent.press(screen.getByRole('button', { name: 'Go back' }));
    expect(mockRouter.replace).toHaveBeenCalledTimes(2);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('radio', { name: 'Dark Mode', checked: true })).toBeTruthy();
  } finally {
    alert.mockRestore();
    mockRouter.canGoBack.mockReturnValue(true);
    jest.clearAllMocks();
  }
});
