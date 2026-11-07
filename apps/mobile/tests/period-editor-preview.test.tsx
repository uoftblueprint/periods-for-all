import { expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import PeriodEditorPreview from '@/app/period-editor-preview';
import { Colors } from '@/constants/theme';
import type { PeriodDateEditorProps } from '@/features/calendar/period-date-editor';

let mockEditorProps: PeriodDateEditorProps;

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
}));

jest.mock('@/features/calendar/period-date-editor', () => ({
  PeriodDateEditor: (props: PeriodDateEditorProps) => {
    mockEditorProps = props;
    return null;
  },
}));

test('provides sample dates and appearance controls to the editor', () => {
  render(<PeriodEditorPreview />);

  expect(mockEditorProps.initialMonth).toBe('2026-10');
  expect(mockEditorProps.today).toBe('2026-10-14');
  expect(mockEditorProps.initialDates).toEqual([
    '2026-10-05',
    '2026-10-06',
    '2026-10-07',
    '2026-10-08',
    '2026-10-09',
  ]);

  fireEvent(screen.getByLabelText('Dark'), 'valueChange', true);
  fireEvent(screen.getByLabelText('Large text'), 'valueChange', true);

  expect(mockEditorProps.appearance.colors).toBe(Colors.dark);
  expect(mockEditorProps.appearance.fontScale).toBe(1.25);
});

test('offers one-shot load and save failures with inspectable save data', async () => {
  render(<PeriodEditorPreview />);

  fireEvent(
    screen.getByLabelText('Fail next month load'),
    'valueChange',
    true,
  );
  await act(async () => {
    await expect(mockEditorProps.loadDates(
      '2026-09-01',
      '2026-09-30',
    )).rejects.toThrow('Preview month load failure');
  });
  expect(screen.getByText(/Month load failed once/)).toBeTruthy();

  let loadedDates: string[] = [];
  await act(async () => {
    loadedDates = await mockEditorProps.loadDates(
      '2026-09-01',
      '2026-09-30',
    );
  });
  expect(loadedDates).toContain('2026-09-23');

  const change = { add: ['2026-10-10'], remove: [] };
  fireEvent(screen.getByLabelText('Fail next save'), 'valueChange', true);
  await act(async () => {
    await expect(mockEditorProps.onSave(change)).rejects.toThrow(
      'Preview save failure',
    );
  });
  expect(screen.getByText(/Save failed once/)).toBeTruthy();
  expect(screen.getByText(/"add":\["2026-10-10"\]/)).toBeTruthy();

  await act(async () => {
    await mockEditorProps.onSave(change);
  });
  act(() => mockEditorProps.onDone());

  expect(mockEditorProps.initialDates).toContain('2026-10-10');
  expect(screen.getByText(/Saved\. The editor reopened/)).toBeTruthy();
});

test('cancel and restore reset the preview editor', () => {
  render(<PeriodEditorPreview />);

  act(() => mockEditorProps.onCancel());
  expect(screen.getByText(/Cancelled\. Draft changes were discarded/)).toBeTruthy();

  fireEvent.press(screen.getByText('Restore sample dates'));
  expect(screen.getByText('Sample dates restored.')).toBeTruthy();
});
