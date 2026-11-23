import { expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import SpoonTasksPreview from '@/app/spoon-tasks-preview';

let listProps: any;
let editorProps: any;
let quickProps: any;

jest.mock('expo-router', () => ({ Stack: { Screen: () => null } }));
jest.mock('@/features/spoons/task-list', () => ({ TaskList: (props: any) => { listProps = props; return null; } }));
jest.mock('@/features/spoons/task-editor', () => ({ TaskEditor: (props: any) => { editorProps = props; return null; } }));
jest.mock('@/features/spoons/quick-task-editor', () => ({ QuickTaskEditor: (props: any) => { quickProps = props; return null; } }));

test('preview switches every required scenario without production wiring', () => {
  render(<SpoonTasksPreview />);
  expect(listProps.tasks).toEqual([]);

  fireEvent.press(screen.getByText('Planned'));
  expect(listProps.tasks).toHaveLength(1);
  fireEvent.press(screen.getByText('Filled optionals'));
  expect(listProps.tasks[0]).toEqual(expect.objectContaining({ time: '09:30', priority: 'high', notes: expect.any(String) }));

  fireEvent.press(screen.getByText('Completed blocked'));
  expect(editorProps.mode.task.completion).not.toBeNull();
  fireEvent.press(screen.getByText('Spend'));
  expect(editorProps.mode).toEqual(expect.objectContaining({ type: 'create', kind: 'spend' }));
  fireEvent.press(screen.getByText('Recharge'));
  expect(editorProps.mode).toEqual(expect.objectContaining({ type: 'create', kind: 'recharge' }));

  fireEvent.press(screen.getByText('Saving'));
  expect(quickProps.mode.type).toBe('create');
  expect(screen.getByText('Saves stay pending for 1.5 seconds.')).toBeTruthy();
  fireEvent.press(screen.getByText('Injected failure'));
  expect(screen.getByText('The next save rejects.')).toBeTruthy();
});
