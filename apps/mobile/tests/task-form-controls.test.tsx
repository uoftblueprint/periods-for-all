import { expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  OptionalScheduleFields,
  PrioritySelector,
  SpoonAmountSelector,
  TaskNotesField,
} from '@/features/spoons/task-form-controls';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings } from '@/foundation/contracts';

const appearance = getAppearance(defaultSettings);

test('spoon amount exposes six labelled radio choices with kind-specific wording', () => {
  const onChange = jest.fn();
  const { rerender } = render(
    <SpoonAmountSelector kind="spend" value={0} onChange={onChange} appearance={appearance} />,
  );
  expect(screen.getByText('Spoon Cost')).toBeTruthy();
  for (let amount = 0; amount <= 5; amount += 1) {
    const radio = screen.getByRole('radio', { name: `${amount} spoons, energy spent` });
    expect(radio.props.accessibilityState.checked).toBe(amount === 0);
  }
  fireEvent.press(screen.getByRole('radio', { name: '4 spoons, energy spent' }));
  expect(onChange).toHaveBeenCalledWith(4);

  rerender(
    <SpoonAmountSelector kind="recharge" value={2} onChange={onChange} appearance={appearance} />,
  );
  expect(screen.getByText('Spoon Worth')).toBeTruthy();
  expect(screen.getByRole('radio', { name: '2 spoons, energy restored' }).props.accessibilityState.checked).toBe(true);
});

test('amount and priority retain text semantics, errors, and disabled state', () => {
  const onChange = jest.fn();
  render(
    <>
      <SpoonAmountSelector
        kind="spend" value={3} onChange={onChange} appearance={appearance}
        disabled error="Choose an amount."
      />
      <PrioritySelector value="medium" onChange={onChange} appearance={appearance} disabled />
    </>,
  );
  expect(screen.getByRole('alert').props.children).toBe('Choose an amount.');
  for (const label of ['Low', 'Medium', 'High']) {
    const radio = screen.getByRole('radio', { name: `${label} priority` });
    expect(radio.props.accessibilityState.disabled).toBe(true);
    expect(radio.props.accessibilityState.checked).toBe(label === 'Medium');
  }
  expect(onChange).not.toHaveBeenCalled();
});

test('optional schedule toggles reveal controlled fields and reminder disclaimer', () => {
  const callbacks = {
    onDateEnabledChange: jest.fn(), onDateChange: jest.fn(),
    onTimeEnabledChange: jest.fn(), onTimeChange: jest.fn(),
  };
  const { rerender } = render(
    <OptionalScheduleFields
      {...callbacks} appearance={appearance}
      dateEnabled={false} date="" timeEnabled={false} time=""
    />,
  );
  expect(screen.queryByLabelText('Task date')).toBeNull();
  expect(screen.getByRole('switch', { name: 'Include date' }).props.accessibilityState.checked).toBe(false);
  fireEvent(screen.getByRole('switch', { name: 'Include date' }), 'valueChange', true);
  expect(callbacks.onDateEnabledChange).toHaveBeenCalledWith(true);

  rerender(
    <OptionalScheduleFields
      {...callbacks} appearance={appearance}
      dateEnabled date="2026-11-22" timeEnabled time="09:30"
      errors={{ date: 'Choose a valid date.', time: 'Choose a valid time.' }}
    />,
  );
  expect(screen.getByLabelText('Task date').props.value).toBe('2026-11-22');
  expect(screen.getByLabelText('Task time').props.value).toBe('09:30');
  expect(screen.getAllByText('No reminder will be sent.')).toHaveLength(2);
  expect(screen.getAllByRole('alert')).toHaveLength(2);
  fireEvent.changeText(screen.getByLabelText('Task date'), '2026-11-23');
  expect(callbacks.onDateChange).toHaveBeenCalledWith('2026-11-23');
});

test('notes remain controlled, multiline, and respect disabled state', () => {
  const onChangeText = jest.fn();
  render(
    <TaskNotesField
      value="Keep this note" onChangeText={onChangeText} appearance={appearance} disabled
    />,
  );
  const input = screen.getByLabelText('Task notes');
  expect(input.props.value).toBe('Keep this note');
  expect(input.props.multiline).toBe(true);
  expect(input.props.editable).toBe(false);
});
