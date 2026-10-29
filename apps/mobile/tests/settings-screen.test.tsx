import { expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SettingsScreen } from '@/features/settings/settings-screen';
import { textSizes, type Settings } from '@/foundation/contracts';

test('each switch changes only its own setting', () => {
  const settings: Settings = { textSize: 'large', colorScheme: 'dark', reduceMotion: true };
  const onChange = jest.fn();
  render(<SettingsScreen settings={Object.freeze({ ...settings })} onChange={onChange} />);

  fireEvent(screen.getByLabelText('Large text'), 'valueChange', false);
  fireEvent(screen.getByLabelText('Dark mode'), 'valueChange', false);
  fireEvent(screen.getByLabelText('Reduce motion'), 'valueChange', false);

  expect(onChange.mock.calls).toEqual([
    [{ ...settings, textSize: 'standard' }],
    [{ ...settings, colorScheme: 'light' }],
    [{ ...settings, reduceMotion: false }],
  ]);
});

test.each(textSizes)('the large-text switch represents saved %s text', (textSize) => {
  render(<SettingsScreen settings={{ textSize, colorScheme: 'highContrast', reduceMotion: false }} onChange={jest.fn()} />);
  expect(screen.getByLabelText('Large text')).toHaveProp('value', textSize !== 'standard');
});
