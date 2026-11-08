import { expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ScrollView } from 'react-native';
import { DayDetails, type DayDetailsProps } from '@/features/calendar/day-details';
import {
  EMOTIONAL_SYMPTOM_OPTIONS, FLOW_OPTIONS, MOOD_OPTIONS, PHYSICAL_SYMPTOM_OPTIONS,
} from '@/features/health/catalog';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings } from '@/foundation/contracts';

// Keep behavior tests synchronous while fonts load; the real font is checked in the preview.
jest.mock('expo-font', () => ({ useFonts: () => [false, null] }));
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
    log, today: '2026-11-06', isPeriodDay: false, onEdit: jest.fn(), onClose: jest.fn(),
    appearance: getAppearance(defaultSettings), ...overrides,
  };
  return { props, view: render(<DayDetails {...props} />) };
}

test.each<[DayDetailsProps['log'], string]>([[empty, 'Track'], [filled, 'Edit Log']])('%s offers %s for the displayed date', (log, action) => {
  const { props } = setup(log);
  expect(screen.getByText('Thu, November 5')).toBeTruthy();
  const texts = action === 'Track' ? ['No experiences tracked on this day.'] :
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
  expect(screen.queryByText('No experiences tracked on this day.')).toBeNull();
});

test.each([
  ...MOOD_OPTIONS.map(({ id, label }) => ({ answer: { mood: id }, label })),
  ...FLOW_OPTIONS.map(({ id, label }) => ({ answer: { flow: id }, label })),
  ...PHYSICAL_SYMPTOM_OPTIONS.map(({ id, label }) => ({ answer: { physicalSymptoms: [id] }, label })),
  ...EMOTIONAL_SYMPTOM_OPTIONS.map(({ id, label }) => ({ answer: { emotionalSymptoms: [id] }, label })),
  { answer: { physicalSymptoms: ['constructor'] }, label: 'constructor' },
  { answer: { emotionalSymptoms: ['unlisted-emotion'] }, label: 'unlisted-emotion' },
])('renders the shared label or unknown symptom ID: $label', ({ answer, label }) => {
  setup({ ...empty, ...answer });
  expect(screen.getByText(label)).toBeTruthy();
});

test.each<Partial<DayDetailsProps['log']>>([
  { mood: 'neutral' }, { flow: 'none' }, { physicalSymptoms: [] },
  { emotionalSymptoms: [] }, { reflection: 'Rested today.' },
])('a single answer offers Edit: %j', (answer) => {
  setup({ ...empty, ...answer });
  expect(screen.getByRole('button', { name: 'Edit Log' })).toBeTruthy();
  expect(screen.getAllByText('Not recorded')).toHaveLength(4);
});

test.each(['2026-11-07', '2026-02-30', 'invalid'])('does not offer editing for %s', (date) => {
  setup({ ...filled, date });
  expect(screen.queryByRole('button', { name: /^(Track|Edit Log)$/ })).toBeNull();
});
test('does not offer editing when today is invalid', () => {
  setup(empty, { today: 'invalid' });
  expect(screen.queryByRole('button', { name: 'Track' })).toBeNull();
});

test('period marking does not follow flow', () => {
  const { props, view } = setup({ ...empty, flow: 'none' }, { isPeriodDay: true });
  expect(screen.getByText('Period day')).toBeTruthy();
  expect(screen.getByText('No Flow')).toBeTruthy();
  view.rerender(<DayDetails {...props} log={filled} isPeriodDay={false} />);
  expect(screen.queryByText('Period day')).toBeNull();
  expect(screen.getByText('Heavy')).toBeTruthy();
});

test('a period-day marker does not turn an unrecorded log into a filled log', () => {
  setup(empty, { isPeriodDay: true });
  expect(screen.getByText('Period day')).toBeTruthy();
  expect(screen.getByText('No experiences tracked on this day.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Track' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Edit Log' })).toBeNull();
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

 test('close requests dismissal independently of card size and editing', () => {
  const { props } = setup(filled);
  fireEvent.press(screen.getByRole('button', { name: 'Close details' }));
  expect(props.onClose).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole('button', { name: 'Expand details' }));
  fireEvent.press(screen.getByRole('button', { name: 'Close details' }));
  expect(props.onClose).toHaveBeenCalledTimes(2);
  expect(props.onEdit).not.toHaveBeenCalled();
  expect(screen.getAllByRole('button')).toHaveLength(3);
});
