import { expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ScrollView } from 'react-native';
import { DayDetails, type DayDetailsProps } from '@/features/calendar/day-details';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings } from '@/foundation/contracts';

void ScrollView;
const empty: DayDetailsProps['log'] = {
  date: '2026-11-05', mood: null, flow: null,
  physicalSymptoms: null, emotionalSymptoms: null, reflection: null,
};
const filled: DayDetailsProps['log'] = {
  ...empty, mood: 'happy', flow: 'heavy', physicalSymptoms: ['headache'],
  emotionalSymptoms: ['lowMotivation'], reflection: 'A quiet day at home.',
};
function setup(log = empty, overrides: Partial<DayDetailsProps> = {}) {
  const props: DayDetailsProps = {
    log, today: '2026-11-06', isPeriodDay: false, onEdit: jest.fn(),
    appearance: getAppearance(defaultSettings), ...overrides,
  };
  return { props, view: render(<DayDetails {...props} />) };
}

test.each<[DayDetailsProps['log'], string]>([[empty, 'Track'], [filled, 'Edit']])('%s offers %s for the displayed date', (log, action) => {
  const { props } = setup(log);
  expect(screen.getByText('Thursday, November 5, 2026')).toBeTruthy();
  const texts = action === 'Track' ? ['Nothing recorded for this day'] :
    ['Happy', 'Heavy', 'Headache', 'Low Motivation', 'A quiet day at home.'];
  for (const text of texts) expect(screen.getByText(text)).toBeTruthy();
  expect(screen.queryByText(/^No (physical|emotional) symptoms$/)).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: action }));
  expect(props.onEdit).toHaveBeenCalledTimes(1);
  expect(props.onEdit).toHaveBeenCalledWith(log.date);
});

test('explicit none answers stay distinct from unanswered fields', () => {
  setup({ ...empty, flow: 'none', physicalSymptoms: [], emotionalSymptoms: [] });
  for (const text of ['No Flow', 'No physical symptoms', 'No emotional symptoms']) {
    expect(screen.getByText(text)).toBeTruthy();
  }
  expect(screen.getAllByText('Not recorded')).toHaveLength(2);
  expect(screen.queryByText('Nothing recorded for this day')).toBeNull();
});

test.each<Partial<DayDetailsProps['log']>>([
  { mood: 'neutral' }, { flow: 'none' }, { physicalSymptoms: [] },
  { emotionalSymptoms: [] }, { reflection: 'Rested today.' },
])('a single answer offers Edit: %j', (answer) => {
  setup({ ...empty, ...answer });
  expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
  expect(screen.getAllByText('Not recorded')).toHaveLength(4);
});

test.each(['2026-11-07', '2026-02-30', 'invalid'])('does not offer editing for %s', (date) => {
  setup({ ...filled, date });
  expect(screen.queryByRole('button', { name: /^(Track|Edit)$/ })).toBeNull();
});
test('does not offer editing when today is invalid', () => {
  setup(empty, { today: 'invalid' });
  expect(screen.queryByRole('button', { name: 'Track' })).toBeNull();
});

test('period marking does not follow flow', () => {
  const { props, view } = setup({ ...empty, flow: 'none' }, { isPeriodDay: true });
  expect(screen.getByText('Recorded period day')).toBeTruthy();
  expect(screen.getByText('No Flow')).toBeTruthy();
  view.rerender(<DayDetails {...props} log={filled} isPeriodDay={false} />);
  expect(screen.getByText('Not marked as a period day')).toBeTruthy();
  expect(screen.getByText('Heavy')).toBeTruthy();
});

test('expansion is accessible, reversible, and resets only for a different date', () => {
  const { props, view } = setup();
  const expand = () => screen.getByRole('button', { name: 'Expand details' });
  expect(expand().props.accessibilityState.expanded).toBe(false);
  fireEvent.press(expand());
  const collapse = screen.getByRole('button', { name: 'Collapse details' });
  expect(collapse.props.accessibilityState.expanded).toBe(true);
  view.rerender(<DayDetails {...props} log={filled} />);
  fireEvent.press(screen.getByRole('button', { name: 'Collapse details' }));
  fireEvent.press(expand());
  view.rerender(<DayDetails {...props} log={{ ...empty, date: '2026-11-04' }} />);
  expect(expand().props.accessibilityState.expanded).toBe(false);
});
