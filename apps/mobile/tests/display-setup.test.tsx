import { useState } from 'react';
import { afterEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Dimensions, Platform, ScrollView } from 'react-native';
import { DisplaySetup } from '@/features/onboarding/display-setup';
import { FontSizeStep } from '@/features/onboarding/font-size-step';
import { ThemeStep } from '@/features/onboarding/theme-step';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings, type Settings } from '@/foundation/contracts';

const originalWindow = Dimensions.get('window');

afterEach(() => {
  act(() => Dimensions.set({ window: originalWindow }));
  jest.restoreAllMocks();
});

function setSystemFontScale(fontScale: number) {
  act(() => Dimensions.set({ window: { ...originalWindow, fontScale } }));
}

function Setup({ finish }: { finish: () => Promise<void> }) {
  const [settings, setSettings] = useState<Settings>({ ...defaultSettings, textSize: 'largest' });
  return <DisplaySetup settings={settings} onChange={setSettings} onFinish={finish} onExit={() => {}} />;
}

test('every setup step and its actions share one scroll region, including save errors', async () => {
  const finish = jest.fn<() => Promise<void>>().mockRejectedValue(new Error('Save failed'));
  render(<Setup finish={finish} />);
  const steps = ["Let's set up your display settings now!", 'Font Sizes', 'Motion Controls', 'Colour Themes'];
  for (const title of steps) {
    const regions = screen.UNSAFE_getAllByType(ScrollView);
    expect(regions).toHaveLength(1);
    const page = within(regions[0]);
    expect(page.getByText('Display setup')).toBeVisible();
    expect(page.getByText(title)).toBeVisible();
    expect(page.getByRole('button', { name: 'Back' })).toBeEnabled();
    expect(page.getByRole('button', { name: 'Skip' })).toBeEnabled();
    await act(async () => fireEvent.press(page.getByRole('button', { name: 'Continue' })));
  }
  const page = within(screen.UNSAFE_getByType(ScrollView));
  expect(page.getByText("We couldn't save your display settings. Please try again.")).toBeVisible();
  expect(page.getByRole('radio', { name: /Default/ })).toBeChecked();
  expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();
  expect(finish).toHaveBeenCalledTimes(1);
});

test('changing steps returns to the top, while changing a choice keeps the scroll position', () => {
  const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
  render(<Setup finish={async () => {}} />);
  scrollTo.mockClear();
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(scrollTo).toHaveBeenLastCalledWith({ y: 0, animated: false });
  scrollTo.mockClear();
  fireEvent.press(screen.getByRole('radio', { name: /Large$/ }));
  expect(scrollTo).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(scrollTo).toHaveBeenCalledTimes(1);
  scrollTo.mockClear();
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(scrollTo).toHaveBeenCalledTimes(1);
});

test('a live system font change refreshes native measurements without resetting the step or choices', () => {
  render(<Setup finish={async () => {}} />);
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.press(screen.getByRole('radio', { name: /Large$/ }));
  const before = screen.UNSAFE_getByType(ScrollView);
  setSystemFontScale(originalWindow.fontScale * 2);
  expect(screen.UNSAFE_getByType(ScrollView)).not.toBe(before);
  expect(screen.getByText('Font Sizes')).toBeVisible();
  expect(screen.getByRole('radio', { name: /^✓ Large$/ })).toBeChecked();
  const resized = screen.UNSAFE_getByType(ScrollView);
  act(() => Dimensions.set({ window: { ...originalWindow, width: originalWindow.width + 100, fontScale: originalWindow.fontScale * 2 } }));
  expect(screen.UNSAFE_getByType(ScrollView)).toBe(resized);
});

test('live system font changes preserve a pending finish, failure, and retry', async () => {
  const { promise: pending, reject } = Promise.withResolvers<void>();
  const finish = jest.fn<() => Promise<void>>().mockReturnValueOnce(pending).mockResolvedValue(undefined);
  render(<Setup finish={finish} />);
  for (let n = 0; n < 3; n++) fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.press(screen.getByRole('radio', { name: /Dark Mode/ }));
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  setSystemFontScale(originalWindow.fontScale * 2);
  expect(screen.getByText('Colour Themes')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
  expect(screen.getByRole('radio', { name: /Dark Mode/ })).toBeChecked();
  fireEvent.press(screen.getByRole('button', { name: 'Saving…' }));
  expect(finish).toHaveBeenCalledTimes(1);
  await act(async () => reject(new Error('Save failed')));
  setSystemFontScale(originalWindow.fontScale);
  expect(screen.getByText("We couldn't save your display settings. Please try again.")).toBeVisible();
  expect(screen.getByRole('radio', { name: /Dark Mode/ })).toBeChecked();
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await screen.findByRole('button', { name: 'Continue' });
  expect(finish).toHaveBeenCalledTimes(2);
});

for (const group of ['font', 'theme'] as const) {
  function Choices({ disabled = false }) {
    const [settings, setSettings] = useState(defaultSettings);
    return group === 'font'
      ? <FontSizeStep disabled={disabled} value={settings.textSize} appearance={getAppearance(settings)}
          onChange={(textSize) => setSettings({ ...settings, textSize })} />
      : <ThemeStep disabled={disabled} value={settings.colorScheme} appearance={getAppearance(settings)}
          onChange={(colorScheme) => setSettings({ ...settings, colorScheme })} />;
  }

  function renderChoices(disabled = false) {
    jest.replaceProperty(Platform, 'OS', 'web');
    render(<Choices disabled={disabled} />, { createNodeMock: () => ({ focus: jest.fn() }) });
    return screen.getAllByRole('radio');
  }

  test(`${group}: Space selects a choice and the selected choice is the only tab stop`, () => {
    const radios = renderChoices();
    expect(radios[0]).toHaveProp('tabIndex', 0);
    expect(radios[1]).toHaveProp('tabIndex', -1);
    const preventDefault = jest.fn();
    fireEvent(radios[1], 'keyDown', { key: ' ', preventDefault });
    expect(radios[1]).toBeChecked();
    expect(radios[1]).toHaveProp('tabIndex', 0);
    expect(radios[0]).toHaveProp('tabIndex', -1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  test(`${group}: arrow keys select adjacent choices and wrap in both directions`, () => {
    const radios = renderChoices();
    const key = (index: number, name: string) => fireEvent(radios[index], 'keyDown', { key: name, preventDefault: jest.fn() });
    key(0, 'ArrowLeft');
    expect(radios.at(-1)).toBeChecked();
    key(radios.length - 1, 'ArrowDown');
    expect(radios[0]).toBeChecked();
    key(0, 'ArrowRight');
    expect(radios[1]).toBeChecked();
    key(1, 'ArrowUp');
    expect(radios[0]).toBeChecked();
  });

  test(`${group}: disabled choices reject keyboard changes and have no tab stops`, () => {
    const radios = renderChoices(true);
    fireEvent(radios[1], 'keyDown', { key: ' ', preventDefault: jest.fn() });
    fireEvent(radios[0], 'keyDown', { key: 'ArrowRight', preventDefault: jest.fn() });
    expect(radios[0]).toBeChecked();
    expect(radios[1]).not.toBeChecked();
    radios.forEach((radio) => expect(radio).toHaveProp('tabIndex', -1));
  });
}
