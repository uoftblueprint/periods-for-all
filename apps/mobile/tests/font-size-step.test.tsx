import { expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FontSizeStep, type FontSizeStepProps } from '@/features/onboarding/font-size-step';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings } from '@/foundation/contracts';

function setup(overrides: Partial<FontSizeStepProps> = {}) {
  const props: FontSizeStepProps = {
    value: 'standard',
    onChange: jest.fn(),
    appearance: getAppearance(defaultSettings),
    ...overrides,
  };
  render(<FontSizeStep {...props} />);
  return props;
}

test('tapping "Largest" calls onChange with "largest"', () => {
  const props = setup();
  fireEvent.press(screen.getByRole('radio', { name: /largest/i }));
  expect(props.onChange).toHaveBeenCalledWith('largest');
});

test('selected choice has checked state', () => {
  setup({ value: 'extraLarge' });
  const selected = screen.getByRole('radio', { name: /extra large/i });
  expect(selected.props.accessibilityState).toEqual(expect.objectContaining({ checked: true }));
});

test('non-selected choice has unchecked state', () => {
  setup({ value: 'standard' });
  const other = screen.getByRole('radio', { name: /large \(1\.25/i });
  expect(other.props.accessibilityState).toEqual(expect.objectContaining({ checked: false }));
});
