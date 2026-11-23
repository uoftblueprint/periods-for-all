import { expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { TaskList } from '@/features/spoons/task-list';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings } from '@/foundation/contracts';

const appearance = getAppearance(defaultSettings);
const tasks = [
  {
    id: 'spend', date: '2026-11-22', name: 'A very long walk that must remain readable', kind: 'spend' as const,
    amount: 3, time: '09:30', priority: 'high' as const,
    subtasks: [
      { id: 'one', name: 'Shoes', done: true }, { id: 'two', name: 'Water', done: false },
    ], completion: null,
  },
  {
    id: 'recharge', date: '2026-11-22', name: 'Rest', kind: 'recharge' as const, amount: 2,
    completion: {
      taskId: 'recharge', kind: 'complete' as const, requestedAmount: 2, appliedChange: 2, at: '2026-11-22T10:00:00.000Z',
    },
  },
];

test('empty list explains the state and delegates add', () => {
  const onAddTask = jest.fn();
  render(<TaskList tasks={[]} appearance={appearance} onAddTask={onAddTask} onEditTask={jest.fn()} onToggleCompletion={jest.fn()} />);
  expect(screen.getByText('No tasks yet')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Add a task' }));
  expect(onAddTask).toHaveBeenCalledTimes(1);
});

test('filled rows expose all meaning in text and delegate unfinished editing', () => {
  const onEditTask = jest.fn();
  render(<TaskList tasks={tasks} appearance={appearance} onAddTask={jest.fn()} onEditTask={onEditTask} onToggleCompletion={jest.fn()} />);
  expect(screen.getByRole('header', { name: '2 tasks' })).toBeTruthy();
  expect(screen.getByText('3 spoons spent · High priority · 09:30 · 1 of 2 subtasks complete')).toBeTruthy();
  expect(screen.getByText('2 spoons restored · Completed')).toBeTruthy();
  const longName = screen.getByText('A very long walk that must remain readable');
  expect(longName.props.numberOfLines).toBeUndefined();
  fireEvent.press(screen.getByRole('button', { name: 'Edit A very long walk that must remain readable' }));
  expect(onEditTask).toHaveBeenCalledWith(tasks[0]);
  expect(screen.queryByRole('button', { name: 'Edit Rest' })).toBeNull();
});

test('completion controls delegate the whole task and disabled mode blocks every action', () => {
  const onToggleCompletion = jest.fn();
  render(<TaskList tasks={tasks} appearance={appearance} disabled onAddTask={jest.fn()} onEditTask={jest.fn()} onToggleCompletion={onToggleCompletion} />);
  const unfinished = screen.getByRole('checkbox', { name: 'Mark A very long walk that must remain readable complete' });
  const completed = screen.getByRole('checkbox', { name: 'Mark Rest incomplete' });
  expect(unfinished.props.accessibilityState).toEqual({ checked: false, disabled: true });
  expect(completed.props.accessibilityState).toEqual({ checked: true, disabled: true });
  expect(screen.getByRole('button', { name: 'Add a task' }).props.accessibilityState.disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Edit A very long walk that must remain readable' }).props.accessibilityState.disabled).toBe(true);
});
