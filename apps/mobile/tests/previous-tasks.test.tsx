import { expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { PreviousTasks, type PreviousTasksProps } from '@/features/spoons/previous-tasks';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings } from '@/foundation/contracts';
import type { SpoonTask, SpoonMove } from '@/features/spoons/contracts';

const appearance = getAppearance(defaultSettings);
const TODAY = '2026-11-25';

const sampleTasks: SpoonTask[] = [
  { id: 't1', date: '2026-11-24', name: 'Change bedsheets', kind: 'spend', amount: 3, completion: null },
  { id: 't2', date: '2026-11-24', name: 'Shower', kind: 'spend', amount: 2, completion: null },
];

/** Renders PreviousTasks with defaults and returns the onMove mock. */
function setup(overrides: Partial<PreviousTasksProps> = {}) {
  const onMove = jest.fn<(input: SpoonMove) => Promise<void>>().mockResolvedValue(undefined);
  const props: PreviousTasksProps = {
    tasks: sampleTasks,
    todayDate: TODAY,
    todayRevision: 0,
    appearance,
    onMove,
    ...overrides,
  };
  render(<PreviousTasks {...props} />);
  return onMove;
}

// -- Rendering --

test('shows header with task count', () => {
  setup();
  expect(screen.getByText(/Previous Tasks/)).toBeTruthy();
  expect(screen.getByText('2')).toBeTruthy();
});

test('shows task names', () => {
  setup();
  expect(screen.getByText('Change bedsheets')).toBeTruthy();
  expect(screen.getByText('Shower')).toBeTruthy();
});

test('shows spoon count per task', () => {
  setup();
  expect(screen.getByText('3 spoons')).toBeTruthy();
  expect(screen.getByText('2 spoons')).toBeTruthy();
});

test('renders nothing when task list is empty', () => {
  setup({ tasks: [] });
  expect(screen.queryByText(/Previous Tasks/)).toBeNull();
});

// -- Collapse/expand --

test('collapse hides tasks, expand shows them again', () => {
  setup();
  expect(screen.getByText('Change bedsheets')).toBeTruthy();
  // Collapse
  fireEvent.press(screen.getByLabelText(/Previous Tasks.*collapse/));
  expect(screen.queryByText('Change bedsheets')).toBeNull();
  // Expand
  fireEvent.press(screen.getByLabelText(/Previous Tasks.*expand/));
  expect(screen.getByText('Change bedsheets')).toBeTruthy();
});

// -- Move to today --

test('tapping move calls onMove with correct task', async () => {
  const onMove = setup();
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Move Change bedsheets to today'));
  });
  expect(onMove).toHaveBeenCalledTimes(1);
  expect(onMove).toHaveBeenCalledWith(
    expect.objectContaining({
      taskId: 't1',
      destinationDate: TODAY,
    }),
  );
});

test('shows error on failed move', async () => {
  const onMove = jest.fn<(input: SpoonMove) => Promise<void>>()
    .mockRejectedValue(new Error('network'));
  setup({ onMove });
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Move Change bedsheets to today'));
  });
  expect(screen.getByText('Could not move task. Try again.')).toBeTruthy();
});

// -- Singular spoon label --

test('shows singular "spoon" for amount 1', () => {
  const tasks: SpoonTask[] = [
    { id: 't1', date: '2026-11-24', name: 'Rest', kind: 'recharge', amount: 1, completion: null },
  ];
  setup({ tasks });
  expect(screen.getByText('1 spoon')).toBeTruthy();
});
