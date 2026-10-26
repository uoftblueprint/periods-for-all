import { expect, jest, test } from '@jest/globals';
import { render, screen, userEvent } from '@testing-library/react-native';
import AppButton from '@/components/app-button';

test('ignores presses while busy; a normal press fires once', async () => {
  const user = userEvent.setup();
  const onBusyPress = jest.fn();
  const onNormalPress = jest.fn();

  render(
    <>
      <AppButton label="Busy" onPress={onBusyPress} busy />
      <AppButton label="Normal" onPress={onNormalPress} />
    </>
  );

  await user.press(screen.getByRole('button', { name: 'Busy' }));
  await user.press(screen.getByRole('button', { name: 'Normal' }));

  expect(onBusyPress).not.toHaveBeenCalled();
  expect(onNormalPress).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Busy' })).toBeBusy();
});