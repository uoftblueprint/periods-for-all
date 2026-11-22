import { afterEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { TaskEditor } from '@/features/spoons/task-editor';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings } from '@/foundation/contracts';

const appearance = getAppearance(defaultSettings);
const createMode = { type: 'create' as const, kind: 'spend' as const, defaultDate: '2026-11-22' };
const task = {
  id: 'task-1', date: '2026-11-22', name: 'Walk', kind: 'spend' as const, amount: 2,
  completion: null,
};
const baseProps = {
  appearance, balance: 4, createSubtaskId: () => 'sub-1', onCancel: jest.fn(),
};

afterEach(() => { jest.restoreAllMocks(); });

test('create editor renders recharge wording and submits a normalized draft', async () => {
  const onSave = jest.fn(async () => {});
  render(<TaskEditor {...baseProps} mode={{ ...createMode, kind: 'recharge' }} onSave={onSave} />);
  expect(screen.getByRole('header', { name: 'Task Details' })).toBeTruthy();
  expect(screen.getByText('Spoon Worth')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Delete task' })).toBeNull();
  fireEvent.changeText(screen.getByLabelText('Task name'), '  Rest  ');
  fireEvent.press(screen.getByRole('radio', { name: '3 spoons, energy restored' }));
  fireEvent.press(screen.getByRole('button', { name: 'Save task' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith({ name: 'Rest', kind: 'recharge', amount: 3 }));
});

test('validation and budget warnings stay visible without calling save', () => {
  const onSave = jest.fn(async () => {});
  render(<TaskEditor {...baseProps} mode={createMode} onSave={onSave} budgetWarning="This exceeds today’s balance." />);
  expect(screen.getByRole('alert', { name: 'This exceeds today’s balance.' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Save task' }));
  expect(screen.getByText('Enter a task name.')).toBeTruthy();
  expect(onSave).not.toHaveBeenCalled();
});

test('completed tasks require undo and expose no save or delete mutation', () => {
  const onSave = jest.fn(async () => {});
  const onDelete = jest.fn(async () => {});
  const onRequestUndo = jest.fn();
  render(
    <TaskEditor
      {...baseProps} mode={{ type: 'edit', defaultDate: task.date, task: {
        ...task, completion: {
          taskId: task.id, kind: 'complete', requestedAmount: 2, appliedChange: -2, at: '2026-11-22T10:00:00.000Z',
        },
      } }}
      onSave={onSave} onDelete={onDelete} onRequestUndo={onRequestUndo}
    />,
  );
  expect(screen.getByText('Undo completion before editing or deleting this task.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Save task' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Delete task' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Undo completion' }));
  expect(onRequestUndo).toHaveBeenCalledTimes(1);
});

test('a ref guard blocks duplicate save presses and rejection retains the exact draft for retry', async () => {
  let rejectFirst!: (error: Error) => void;
  const first = new Promise<void>((_, reject) => { rejectFirst = reject; });
  const onSave = jest.fn(() => onSave.mock.calls.length === 1 ? first : Promise.resolve());
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  render(<TaskEditor {...baseProps} mode={createMode} onSave={onSave} />);
  fireEvent.changeText(screen.getByLabelText('Task name'), 'Keep this draft');
  const save = screen.getByRole('button', { name: 'Save task' });
  fireEvent.press(save);
  fireEvent.press(save);
  expect(onSave).toHaveBeenCalledTimes(1);
  await act(async () => rejectFirst(new Error('offline')));
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledTimes(1));
  expect(screen.getByLabelText('Task name').props.value).toBe('Keep this draft');
  fireEvent.press(screen.getByRole('button', { name: 'Save task' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
});

test('edit mode confirms delete, guards duplicate confirmation actions, and allows retry', async () => {
  let rejectFirst!: (error: Error) => void;
  const first = new Promise<void>((_, reject) => { rejectFirst = reject; });
  const onDelete = jest.fn(() => onDelete.mock.calls.length === 1 ? first : Promise.resolve());
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  render(<TaskEditor {...baseProps} mode={{ type: 'edit', task, defaultDate: task.date }} onSave={jest.fn(async () => {})} onDelete={onDelete} />);
  fireEvent.press(screen.getByRole('button', { name: 'Delete task' }));
  const buttons = alert.mock.calls[0][2]!;
  const destructive = buttons.find((button) => button.style === 'destructive')!;
  act(() => { destructive.onPress?.(); destructive.onPress?.(); });
  expect(onDelete).toHaveBeenCalledTimes(1);
  await act(async () => rejectFirst(new Error('offline')));
  await waitFor(() => expect(alert).toHaveBeenCalledTimes(2));
  fireEvent.press(screen.getByRole('button', { name: 'Delete task' }));
  await act(async () => {
    alert.mock.calls[2][2]!.find((button) => button.style === 'destructive')!.onPress?.();
  });
  await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(2));
});

test('cancel delegates immediately and edit mode initializes optional values', () => {
  const onCancel = jest.fn();
  render(<TaskEditor {...baseProps} onCancel={onCancel} mode={{ type: 'edit', defaultDate: task.date, task: {
    ...task, time: '08:15', priority: 'high', notes: 'Bring water',
    subtasks: [{ id: 'sub-1', name: 'Shoes', done: false }],
  } }} onSave={jest.fn(async () => {})} />);
  expect(screen.getByLabelText('Task name').props.value).toBe('Walk');
  expect(screen.getByLabelText('Task time').props.value).toBe('08:15');
  expect(screen.getByLabelText('Task notes').props.value).toBe('Bring water');
  expect(screen.getByRole('radio', { name: 'High priority' }).props.accessibilityState.checked).toBe(true);
  fireEvent.press(screen.getByRole('button', { name: 'Cancel editing' }));
  expect(onCancel).toHaveBeenCalledTimes(1);
});

test('a refreshed edit source with the same ID replaces stale fields', () => {
  const props = { ...baseProps, onSave: jest.fn(async () => {}) };
  const { rerender } = render(
    <TaskEditor {...props} mode={{ type: 'edit', task, defaultDate: task.date }} />,
  );
  fireEvent.changeText(screen.getByLabelText('Task name'), 'Unsaved local value');
  rerender(
    <TaskEditor {...props} mode={{
      type: 'edit', defaultDate: task.date, task: { ...task, name: 'Refreshed server value', amount: 4 },
    }} />,
  );
  expect(screen.getByLabelText('Task name').props.value).toBe('Refreshed server value');
  expect(screen.getByRole('radio', { name: '4 spoons, energy spent' }).props.accessibilityState.checked).toBe(true);
});
