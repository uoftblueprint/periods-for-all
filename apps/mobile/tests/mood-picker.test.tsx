import { expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { MoodPicker, type MoodPickerProps } from '@/features/health/mood-picker';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings } from '@/foundation/contracts';

const appearance = getAppearance(defaultSettings);

/** Renders MoodPicker with defaults and returns props for assertions. */
function setup(overrides: Partial<MoodPickerProps> = {}) {
  const props: MoodPickerProps = {
    value: null,
    onChange: jest.fn(),
    appearance,
    ...overrides,
  };
  render(<MoodPicker {...props} />);
  return props;
}

test('tapping Happy calls onChange with "happy"', () => {
  const props = setup();
  fireEvent.press(screen.getByRole('radio', { name: 'Happy' }));
  expect(props.onChange).toHaveBeenCalledWith('happy');
});

test('tapping Very Sad calls onChange with "verySad"', () => {
  const props = setup();
  fireEvent.press(screen.getByRole('radio', { name: 'Very Sad' }));
  expect(props.onChange).toHaveBeenCalledWith('verySad');
});

test('selected mood has checked state', () => {
  setup({ value: 'neutral' });
  const choice = screen.getByRole('radio', { name: 'Neutral' });
  expect(choice.props.accessibilityState).toEqual(expect.objectContaining({ checked: true }));
});

test('non-selected mood has unchecked state', () => {
  setup({ value: 'happy' });
  const other = screen.getByRole('radio', { name: 'Sad' });
  expect(other.props.accessibilityState).toEqual(expect.objectContaining({ checked: false }));
});

test('shows mood label when selected', () => {
  setup({ value: 'veryHappy' });
  expect(screen.getByText(/Very Happy/)).toBeTruthy();
});

test('shows placeholder when no mood selected', () => {
  setup({ value: null });
  expect(screen.getByText(/Mood/)).toBeTruthy();
});
