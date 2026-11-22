import { expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SubtaskEditor } from '@/features/spoons/subtask-editor';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings } from '@/foundation/contracts';

const appearance = getAppearance(defaultSettings);
const subtasks = [
  { id: 'first-stable-id', name: 'Pack water', done: false },
  { id: 'second-stable-id', name: 'Wear shoes', done: true },
];

test('empty editor generates one stable ID per add and delegates it outward', () => {
  const createSubtaskId = jest.fn(() => 'new-stable-id');
  const onAdd = jest.fn();
  render(
    <SubtaskEditor
      subtasks={[]} appearance={appearance} createSubtaskId={createSubtaskId}
      onAdd={onAdd} onRename={jest.fn()} onCheck={jest.fn()} onRemove={jest.fn()}
    />,
  );
  fireEvent.press(screen.getByRole('button', { name: 'Break down your task' }));
  expect(createSubtaskId).toHaveBeenCalledTimes(1);
  expect(onAdd).toHaveBeenCalledWith('new-stable-id');
});

test('filled editor delegates rename, check, and remove by stable ID', () => {
  const onRename = jest.fn();
  const onCheck = jest.fn();
  const onRemove = jest.fn();
  render(
    <SubtaskEditor
      subtasks={subtasks} appearance={appearance} createSubtaskId={() => 'unused'}
      onAdd={jest.fn()} onRename={onRename} onCheck={onCheck} onRemove={onRemove}
    />,
  );
  fireEvent.changeText(screen.getByLabelText('Subtask 1'), 'Pack two bottles');
  expect(onRename).toHaveBeenCalledWith('first-stable-id', 'Pack two bottles');
  fireEvent.press(screen.getByRole('checkbox', { name: 'Mark Pack water complete' }));
  expect(onCheck).toHaveBeenCalledWith('first-stable-id', true);
  expect(screen.getByRole('checkbox', { name: 'Mark Wear shoes incomplete' }).props.accessibilityState.checked).toBe(true);
  fireEvent.press(screen.getByRole('button', { name: 'Remove Pack water' }));
  expect(onRemove).toHaveBeenCalledWith('first-stable-id');
});

test('subtask checks cannot trigger task completion or energy changes', () => {
  const onCheck = jest.fn();
  const props = {
    subtasks: [subtasks[0]], appearance, createSubtaskId: () => 'unused',
    onAdd: jest.fn(), onRename: jest.fn(), onCheck, onRemove: jest.fn(),
  };
  expect(props).not.toHaveProperty('onToggleTaskCompletion');
  expect(props).not.toHaveProperty('onEnergyChange');
  render(<SubtaskEditor {...props} />);
  fireEvent.press(screen.getByRole('checkbox', { name: 'Mark Pack water complete' }));
  expect(onCheck).toHaveBeenCalledTimes(1);
});

test('errors are associated with rows and disabled mode blocks every mutating control', () => {
  render(
    <SubtaskEditor
      subtasks={subtasks} appearance={appearance} createSubtaskId={() => 'unused'}
      onAdd={jest.fn()} onRename={jest.fn()} onCheck={jest.fn()} onRemove={jest.fn()}
      errors={{ 'first-stable-id': 'Enter a subtask name.' }} disabled
    />,
  );
  expect(screen.getByRole('alert').props.children).toBe('Enter a subtask name.');
  expect(screen.getByLabelText('Subtask 1').props.editable).toBe(false);
  expect(screen.getByRole('checkbox', { name: 'Mark Pack water complete' }).props.accessibilityState.disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Remove Pack water' }).props.accessibilityState.disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Add subtask' }).props.accessibilityState.disabled).toBe(true);
});
