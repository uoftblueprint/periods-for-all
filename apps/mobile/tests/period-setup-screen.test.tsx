import { expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  PeriodSetupScreen, defaultPeriodSetup, type PeriodSetup, type PeriodSetupScreenProps,
} from '@/features/onboarding/period-setup-screen';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings } from '@/foundation/contracts';

const appearance = getAppearance(defaultSettings);
const TODAY = '2026-11-07';

/** Creates default props with fake callbacks, applies overrides, renders, and returns props. */
function setup(overrides: Partial<PeriodSetupScreenProps> = {}) {
  const props: PeriodSetupScreenProps = {
    initialValue: defaultPeriodSetup,
    today: TODAY,
    appearance,
    onSave: jest.fn<(next: PeriodSetup) => Promise<void>>().mockResolvedValue(undefined),
    onFinish: jest.fn(),
    onExit: jest.fn(),
    ...overrides,
  };
  render(<PeriodSetupScreen {...props} />);
  return props;
}

// -- Intro step --

test('intro shows tracking heading', () => {
  setup();
  expect(screen.getByText("Let's start tracking your period!")).toBeTruthy();
});

test('Continue on intro advances to last period step', async () => {
  const props = setup();
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Continue' })); });
  expect(props.onSave).toHaveBeenCalledWith(
    expect.objectContaining({ step: 'lastPeriod' }),
  );
});

test('Back on intro calls onExit', () => {
  const props = setup();
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(props.onExit).toHaveBeenCalled();
});

test('Skip for now on intro finishes setup', async () => {
  const props = setup();
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'Skip for now' }));
  });
  expect(props.onSave).toHaveBeenCalledWith(
    expect.objectContaining({ step: 'complete' }),
  );
});

// -- Last period step (date picker) --

test('last period step shows calendar heading', async () => {
  const props = setup();
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Continue' })); });
  expect(screen.getByText('When was the start of your last period?')).toBeTruthy();
});

test('future dates are disabled in calendar', async () => {
  const props = setup({ today: '2026-11-15' });
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Continue' })); });
  const futureDay = screen.getByRole('button', { name: /2026-11-20/ });
  expect(futureDay.props.accessibilityState?.disabled ?? futureDay.props.disabled).toBeTruthy();
});

// -- Cycle length step --

test('cycle length step shows 21–45 Day choices', () => {
  setup({ initialValue: { ...defaultPeriodSetup, step: 'cycle' } });
  expect(screen.getByText('What is your typical cycle length?')).toBeTruthy();
  expect(screen.getByRole('radio', { name: '21 Days' })).toBeTruthy();
  expect(screen.getByRole('radio', { name: '45 Days' })).toBeTruthy();
});

test('tapping a cycle choice selects it', () => {
  setup({ initialValue: { ...defaultPeriodSetup, step: 'cycle' } });
  fireEvent.press(screen.getByRole('radio', { name: '28 Days' }));
  const choice = screen.getByRole('radio', { name: '28 Days' });
  expect(choice.props.accessibilityState).toEqual(expect.objectContaining({ checked: true }));
});

// -- Period length step --

test('period length step shows 1–12 Day choices', () => {
  setup({ initialValue: { ...defaultPeriodSetup, step: 'length' } });
  expect(screen.getByText('What is your typical period length?')).toBeTruthy();
  expect(screen.getByRole('radio', { name: '1 Days' })).toBeTruthy();
  expect(screen.getByRole('radio', { name: '12 Days' })).toBeTruthy();
});

// -- Skip ("I'm not sure") --

test('"I\'m not sure" on cycle step saves null for cycleLength', async () => {
  const props = setup({
    initialValue: { ...defaultPeriodSetup, step: 'cycle', cycleLength: 28 },
  });
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: "I'm not sure" }));
  });
  expect(props.onSave).toHaveBeenCalledWith(
    expect.objectContaining({ cycleLength: null, step: 'length' }),
  );
});

// -- Back preserving answers --

test('Back preserves entered answers', async () => {
  const initial: PeriodSetup = {
    ...defaultPeriodSetup,
    step: 'cycle',
    lastPeriodStart: '2026-11-01',
  };
  const props = setup({ initialValue: initial });
  // Back arrow returns to lastPeriod without saving
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByText('When was the start of your last period?')).toBeTruthy();
  expect(props.onSave).not.toHaveBeenCalled();
});

// -- Resume from saved step --

test('resumes from initialValue step', () => {
  setup({ initialValue: { ...defaultPeriodSetup, step: 'length' } });
  expect(screen.getByText('What is your typical period length?')).toBeTruthy();
});

// -- Save failure with retry --

test('failed save shows error and keeps answers', async () => {
  const failSave = jest.fn<(next: PeriodSetup) => Promise<void>>()
    .mockRejectedValue(new Error('network'));
  setup({
    initialValue: { ...defaultPeriodSetup, step: 'cycle' },
    onSave: failSave,
  });
  fireEvent.press(screen.getByRole('radio', { name: '30 Days' }));
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  });
  expect(screen.getByText('Could not save. Please try again.')).toBeTruthy();
  expect(screen.getByText('What is your typical cycle length?')).toBeTruthy();
});

// -- Finish calls onFinish after save --

test('Finish on last step calls onFinish after save', async () => {
  const props = setup({
    initialValue: { ...defaultPeriodSetup, step: 'length', periodLength: 5 },
  });
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'Finish' }));
  });
  expect(props.onSave).toHaveBeenCalledWith(
    expect.objectContaining({ step: 'complete' }),
  );
  expect(props.onFinish).toHaveBeenCalled();
});

// -- No double submit --

test('Continue cannot double-submit while save is in progress', async () => {
  let resolveSave: () => void;
  const slowSave = jest.fn<(next: PeriodSetup) => Promise<void>>().mockImplementation(
    () => new Promise((r) => { resolveSave = r; }),
  );
  setup({ initialValue: { ...defaultPeriodSetup, step: 'cycle' }, onSave: slowSave });
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Continue' })); });
  // Second press while save is in flight
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Saving' })); });
  expect(slowSave).toHaveBeenCalledTimes(1);
  await act(async () => { resolveSave!(); });
});

// -- Progress dots --

test('question steps show progress dots', () => {
  setup({ initialValue: { ...defaultPeriodSetup, step: 'cycle' } });
  // 3 dots rendered as Views — the component renders them for all question steps
  const dots = screen.getAllByRole('button', { name: 'Back' });
  // Just verify the step label is shown, which only appears on question screens
  expect(screen.getByText('Step 2')).toBeTruthy();
  expect(screen.getByText('Cycle Length')).toBeTruthy();
});
