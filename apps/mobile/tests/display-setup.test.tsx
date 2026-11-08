import { useState } from 'react';
import { afterEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Platform, ScrollView } from 'react-native';
import { DisplaySetup } from '@/features/onboarding/display-setup';
import { FontSizeStep } from '@/features/onboarding/font-size-step';
import { ThemeStep } from '@/features/onboarding/theme-step';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings, type Settings } from '@/foundation/contracts';

jest.mock('@expo-google-fonts/atkinson-hyperlegible', () => ({ useFonts: () => [true, null] }));

// Resolve the lazy native mock before Jest starts timing individual tests.
void ScrollView;

afterEach(() => { jest.restoreAllMocks(); });

function Setup({ finish }: { finish: () => Promise<void> }) {
  const [settings, setSettings] = useState<Settings>({ ...defaultSettings, textSize: 'largest' });
  return <DisplaySetup settings={settings} onChange={setSettings} onFinish={finish} onExit={() => {}} />;
}

test('step content and finish actions share one scroll region, with Back available in the header', async () => {
  const finish = jest.fn<() => Promise<void>>().mockRejectedValue(new Error('Save failed'));
  render(<Setup finish={finish} />);
  const steps = ["Let’s set up your display settings now!", 'Font Sizes', 'Motion Controls', 'Colour Themes'];
  for (const title of steps) {
    const regions = screen.UNSAFE_getAllByType(ScrollView);
    expect(regions).toHaveLength(1);
    const page = within(regions[0]);
    expect(page.getByText('Display setup')).toBeVisible();
    expect(screen.getByText(title)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Back' })).toBeEnabled();
    expect(page.getByRole('button', { name: /^Skip/ })).toBeEnabled();
    await act(async () => fireEvent.press(page.getByRole('button', { name: /^Continue/ })));
  }
  const page = within(screen.UNSAFE_getByType(ScrollView));
  expect(page.getByText("We couldn't save your display settings. Please try again.")).toBeVisible();
  expect(page.getByRole('radio', { name: /Default/ })).toBeChecked();
  expect(page.getByRole('button', { name: /^Continue/ })).toBeEnabled();
  expect(finish).toHaveBeenCalledTimes(1);
});

test('largest-text step headers and Back stay inside the scroll region', () => {
  render(<Setup finish={async () => {}} />);
  fireEvent.press(screen.getByRole('button', { name: /^Continue/ }));
  for (const [index, title] of ['Font Sizes', 'Motion Controls', 'Colour Themes'].entries()) {
    const page = within(screen.UNSAFE_getByType(ScrollView));
    expect(page.getByRole('header', { name: title })).toBeVisible();
    expect(page.getByText(`Step ${index + 1} of 3`)).toBeVisible();
    expect(page.getByRole('button', { name: 'Back' })).toBeEnabled();
    if (index < 2) fireEvent.press(page.getByRole('button', { name: /^Continue/ }));
  }
});

test('changing steps returns to the top, while changing a choice keeps the scroll position', () => {
  const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
  render(<Setup finish={async () => {}} />);
  scrollTo.mockClear();
  fireEvent.press(screen.getByRole('button', { name: /^Continue/ }));
  expect(scrollTo).toHaveBeenLastCalledWith({ y: 0, animated: false });
  scrollTo.mockClear();
  fireEvent.press(screen.getByRole('radio', { name: /Large$/ }));
  expect(scrollTo).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: /^Continue/ }));
  expect(scrollTo).toHaveBeenCalledTimes(1);
  scrollTo.mockClear();
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(scrollTo).toHaveBeenCalledTimes(1);
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

  test(`${group}: Space/arrows select, wrap and keep one tab stop`, () => {
    const radios = renderChoices();
    const preventDefault = jest.fn();
    const key = (index: number, name: string) => fireEvent(radios[index], 'keyDown', { key: name, preventDefault });
    expect(radios[0]).toHaveProp('tabIndex', 0);
    expect(radios[1]).toHaveProp('tabIndex', -1);
    key(1, ' ');
    expect(radios[1]).toBeChecked();
    expect(radios[1]).toHaveProp('tabIndex', 0);
    expect(radios[0]).toHaveProp('tabIndex', -1);
    key(1, 'ArrowUp');
    expect(radios[0]).toBeChecked();
    key(0, 'ArrowLeft');
    expect(radios.at(-1)).toBeChecked();
    key(radios.length - 1, 'ArrowDown');
    expect(radios[0]).toBeChecked();
    key(0, 'ArrowRight');
    expect(radios[1]).toBeChecked();
    expect(preventDefault).toHaveBeenCalledTimes(5);
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
