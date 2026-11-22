import { afterEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, ScrollView } from 'react-native';
import { QuickTaskEditor } from '@/features/spoons/quick-task-editor';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings } from '@/foundation/contracts';

const appearance = getAppearance(defaultSettings);
const createMode = { type: 'create' as const, kind: 'spend' as const, defaultDate: '2026-11-22' };
const task = { id: 'task-1', date: '2026-11-22', name: 'Walk', kind: 'spend' as const, amount: 2, completion: null };
const props = { appearance, createSubtaskId: () => 'sub-1', onCancel: jest.fn(), onOpenDetails: jest.fn() };

afterEach(() => { jest.restoreAllMocks(); });

test('quick create autofocuses, keeps explicit actions, and discards without deleting', () => {
  const onCancel = jest.fn();
  render(<QuickTaskEditor {...props} mode={createMode} onCancel={onCancel} onSave={jest.fn(async () => {})} />);
  expect(screen.getByLabelText('Task name').props.autoFocus).toBe(true);
  for (const name of ['Save task', 'Cancel editing', 'Date & Time', 'Spoons', 'More details']) {
    expect(screen.getByRole('button', { name })).toBeTruthy();
  }
  expect(screen.getByRole('button', { name: 'Discard new task' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Discard new task' }));
  expect(onCancel).toHaveBeenCalledTimes(1);
});

test('compact panels edit amount and date/time while More hands off raw invalid state losslessly', () => {
  const onOpenDetails = jest.fn();
  render(<QuickTaskEditor {...props} mode={createMode} onOpenDetails={onOpenDetails} onSave={jest.fn(async () => {})} />);
  fireEvent.changeText(screen.getByLabelText('Task name'), 'Partial task');
  fireEvent.press(screen.getByRole('button', { name: 'Spoons' }));
  fireEvent.press(screen.getByRole('radio', { name: '4 spoons, energy spent' }));
  fireEvent.press(screen.getByRole('button', { name: 'Date & Time' }));
  fireEvent(screen.getByRole('switch', { name: 'Include date' }), 'valueChange', true);
  fireEvent.changeText(screen.getByLabelText('Task date'), 'invalid raw date');
  fireEvent.press(screen.getByRole('button', { name: 'More details' }));
  expect(onOpenDetails).toHaveBeenCalledWith(expect.objectContaining({
    name: 'Partial task', amount: 4, dateEnabled: true, date: 'invalid raw date',
  }));
});

test('Return and repeated Save submit only once, then a rejection retains the draft for retry', async () => {
  let rejectFirst!: (error: Error) => void;
  const first = new Promise<void>((_, reject) => { rejectFirst = reject; });
  const onSave = jest.fn(() => onSave.mock.calls.length === 1 ? first : Promise.resolve());
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  render(<QuickTaskEditor {...props} mode={createMode} onSave={onSave} />);
  const input = screen.getByLabelText('Task name');
  fireEvent.changeText(input, 'Keep me');
  fireEvent(input, 'submitEditing');
  fireEvent.press(screen.getByRole('button', { name: 'Save task' }));
  expect(onSave).toHaveBeenCalledTimes(1);
  await act(async () => rejectFirst(new Error('offline')));
  expect(screen.getByLabelText('Task name').props.value).toBe('Keep me');
  fireEvent.press(screen.getByRole('button', { name: 'Save task' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
});

test('edit mode initializes fields and confirms delete', async () => {
  const onDelete = jest.fn(async () => {});
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  render(<QuickTaskEditor {...props} mode={{ type: 'edit', task, defaultDate: task.date }} onSave={jest.fn(async () => {})} onDelete={onDelete} />);
  expect(screen.getByLabelText('Task name').props.value).toBe('Walk');
  fireEvent.press(screen.getByRole('button', { name: 'Delete task' }));
  await act(async () => {
    alert.mock.calls[0][2]!.find((button) => button.style === 'destructive')!.onPress?.();
  });
  expect(onDelete).toHaveBeenCalledTimes(1);
});

test('expanded controls stay in a keyboard-friendly scroll container', () => {
  const view = render(<QuickTaskEditor {...props} mode={createMode} onSave={jest.fn(async () => {})} />);
  const scroll = view.UNSAFE_getByType(ScrollView);
  expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
  expect(scroll.props.contentContainerStyle).toEqual(expect.objectContaining({ flexGrow: 1 }));
});

test('a delete confirmation from a replaced quick editor cannot delete the refreshed task', () => {
  const onDelete = jest.fn(async () => {});
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const editorProps = { ...props, onSave: jest.fn(async () => {}), onDelete };
  const { rerender } = render(
    <QuickTaskEditor {...editorProps} mode={{ type: 'edit', task, defaultDate: task.date }} />,
  );
  fireEvent.press(screen.getByRole('button', { name: 'Delete task' }));
  const confirm = alert.mock.calls[0][2]!.find((button) => button.style === 'destructive')!;

  rerender(<QuickTaskEditor {...editorProps} mode={{ type: 'edit', defaultDate: task.date, task: {
    ...task,
    completion: {
      taskId: task.id, kind: 'complete', requestedAmount: 2, appliedChange: -2, at: '2026-11-22T10:00:00.000Z',
    },
  } }} />);
  act(() => confirm.onPress?.());

  expect(onDelete).not.toHaveBeenCalled();
});

test('completed edits expose no save or delete path', () => {
  render(<QuickTaskEditor {...props} mode={{ type: 'edit', defaultDate: task.date, task: {
    ...task, completion: {
      taskId: task.id, kind: 'complete', requestedAmount: 2, appliedChange: -2, at: '2026-11-22T10:00:00.000Z',
    },
  } }} onSave={jest.fn(async () => {})} onDelete={jest.fn(async () => {})} />);
  expect(screen.getByText('Undo completion before editing this task.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Save task' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Delete task' })).toBeNull();
});
