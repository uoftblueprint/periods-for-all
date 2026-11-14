import { expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import SymptomsPreview from '@/app/symptoms-preview';
import { SymptomPicker } from '@/features/health/symptom-picker';
import { ReflectionInput } from '@/features/health/reflection-input';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings } from '@/foundation/contracts';
import { PHYSICAL_SYMPTOM_OPTIONS, EMOTIONAL_SYMPTOM_OPTIONS } from '@/features/health/catalog';

const appearance = getAppearance(defaultSettings);
const options = [{ id: 'headache', label: 'Headache' }, { id: 'fatigue', label: 'Fatigue' }];

test('opening does not answer; selection and clearing callbacks preserve distinct values', () => {
  const onChange = jest.fn();
  const props = { label: 'Physical', options, onChange, appearance };
  const { rerender } = render(<SymptomPicker {...props} value={null} />);
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'No symptoms' }).props.accessibilityState.selected).toBe(false);
  fireEvent.press(screen.getByText('Headache'));
  expect(onChange).toHaveBeenLastCalledWith(['headache']);
  rerender(<SymptomPicker {...props} value={['headache']} />);
  expect(screen.getByRole('button', { name: 'Headache' }).props.accessibilityState.selected).toBe(true);
  fireEvent.press(screen.getByText('Fatigue'));
  expect(onChange).toHaveBeenLastCalledWith(['headache', 'fatigue']);
  rerender(<SymptomPicker {...props} value={['headache', 'fatigue']} />);
  fireEvent.press(screen.getByText('Headache'));
  expect(onChange).toHaveBeenLastCalledWith(['fatigue']);
  fireEvent.press(screen.getByText('No symptoms'));
  expect(onChange).toHaveBeenLastCalledWith([]);
  rerender(<SymptomPicker {...props} value={[]} />);
  expect(screen.getByRole('button', { name: 'No symptoms' }).props.accessibilityState.selected).toBe(true);
  fireEvent.press(screen.getByText('Fatigue'));
  expect(onChange).toHaveBeenLastCalledWith(['fatigue']);
  fireEvent.press(screen.getByText('Clear answer'));
  expect(onChange).toHaveBeenLastCalledWith(null);
});

test('preview keeps multiple selections and categories independent', () => {
  render(<SymptomsPreview />);
  for (const { label } of [...PHYSICAL_SYMPTOM_OPTIONS, ...EMOTIONAL_SYMPTOM_OPTIONS]) {
    expect(screen.getByRole('button', { name: label }).props.accessibilityState.selected).toBe(false);
  }
  fireEvent.press(screen.getByText('Headache'));
  fireEvent.press(screen.getByText('Back Pain'));
  fireEvent.press(screen.getByText('Anxiety'));
  for (const name of ['Headache', 'Back Pain', 'Anxiety']) {
    expect(screen.getByRole('button', { name }).props.accessibilityState.selected).toBe(true);
  }
  fireEvent.press(screen.getByText('Headache'));
  expect(screen.getByRole('button', { name: 'Headache' }).props.accessibilityState.selected).toBe(false);
  expect(screen.getByRole('button', { name: 'Anxiety' }).props.accessibilityState.selected).toBe(true);
});

test('reflection forwards editing, empty clearing and blur, and configures the native limit', () => {
  const onChangeText = jest.fn();
  const onBlur = jest.fn();
  const props = { onChangeText, onBlur, appearance };
  const { rerender } = render(<ReflectionInput {...props} value="" />);
  const input = screen.getByPlaceholderText('How was today?');
  expect(input.props.multiline).toBe(true);
  expect(input.props.maxLength).toBe(1000);
  expect(onChangeText).not.toHaveBeenCalled();
  fireEvent.changeText(input, 'A good day');
  expect(onChangeText).toHaveBeenLastCalledWith('A good day');
  rerender(<ReflectionInput {...props} value={'a'.repeat(1000)} />);
  expect(screen.getByPlaceholderText('How was today?').props.value).toBe('a'.repeat(1000));
  fireEvent.changeText(input, '');
  expect(onChangeText).toHaveBeenLastCalledWith('');
  fireEvent(input, 'blur');
  expect(onBlur).toHaveBeenCalledTimes(1);
});
