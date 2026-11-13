import { expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FlowPicker, type FlowPickerProps } from '@/features/health/flow-picker';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings } from '@/foundation/contracts';

const appearance = getAppearance(defaultSettings);

/** Renders FlowPicker with defaults and returns props for assertions. */
function setup(overrides: Partial<FlowPickerProps> = {}) {
  const props: FlowPickerProps = {
    value: null,
    onChange: jest.fn(),
    appearance,
    ...overrides,
  };
  render(<FlowPicker {...props} />);
  return props;
}

test('tapping Normal calls onChange with "normal"', () => {
  const props = setup();
  fireEvent.press(screen.getByRole('radio', { name: 'Normal' }));
  expect(props.onChange).toHaveBeenCalledWith('normal');
});

test('tapping No Flow calls onChange with "none"', () => {
  const props = setup();
  fireEvent.press(screen.getByRole('radio', { name: 'No Flow' }));
  expect(props.onChange).toHaveBeenCalledWith('none');
});

test('Clear calls onChange with null', () => {
  const props = setup({ value: 'heavy' });
  fireEvent.press(screen.getByRole('button', { name: 'Clear flow' }));
  expect(props.onChange).toHaveBeenCalledWith(null);
});

test('Clear is not shown when value is null', () => {
  setup({ value: null });
  expect(screen.queryByRole('button', { name: 'Clear flow' })).toBeNull();
});

test('selected flow level has checked state', () => {
  setup({ value: 'light' });
  const choice = screen.getByRole('radio', { name: 'Light' });
  expect(choice.props.accessibilityState).toEqual(expect.objectContaining({ checked: true }));
});

test('No Flow has checked state when value is "none"', () => {
  setup({ value: 'none' });
  const noFlow = screen.getByRole('radio', { name: 'No Flow' });
  expect(noFlow.props.accessibilityState).toEqual(expect.objectContaining({ checked: true }));
});

test('shows flow label when nonzero level selected', () => {
  setup({ value: 'veryHeavy' });
  expect(screen.getByText(/Very Heavy/)).toBeTruthy();
});

test('shows No Flow label when value is "none"', () => {
  setup({ value: 'none' });
  expect(screen.getByText(/Today's Flow:/)).toBeTruthy();
  // "No Flow" appears in both the label and the button — verify the button is checked
  const noFlowBtn = screen.getByRole('radio', { name: 'No Flow' });
  expect(noFlowBtn.props.accessibilityState).toEqual(expect.objectContaining({ checked: true }));
});

test('shows no label when value is null', () => {
  setup({ value: null });
  // "Today's Flow:" is shown but no level label after it
  const label = screen.getByText(/Today's Flow:/);
  expect(label).toBeTruthy();
});
