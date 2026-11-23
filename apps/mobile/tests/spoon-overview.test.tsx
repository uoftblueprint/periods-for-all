import { expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SpoonOverview } from '@/features/spoons/spoon-overview';
import type { SpoonDay } from '@/features/spoons/contracts';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings } from '@/foundation/contracts';

const appearance = getAppearance(defaultSettings);
const day: SpoonDay = { date: '2026-11-22', startingEnergy: null, balance: null, revision: 0, tasks: [], effects: [] };
const save = () => jest.fn<(amount: number) => Promise<void>>().mockResolvedValue(undefined);
const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

test.each([0, 5])('only records %i after Continue', async amount => {
    const onSave = save();
    const view = (record: SpoonDay | null) => <SpoonOverview appearance={appearance} day={record} onSaveStartingEnergy={onSave} />;
    const { rerender } = render(view(null));
    expect(screen.getByText(/Loading today's spoons/)).toBeTruthy();
    expect(screen.queryByText('Continue')).toBeNull();
    rerender(view(day));
    if (amount) press('5 spoons');
    expect(onSave).not.toHaveBeenCalled();
    press('Continue');
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(amount));
    rerender(view({ ...day, startingEnergy: amount, balance: amount }));
    expect(screen.queryByText('Continue')).toBeNull();
    rerender(view({ ...day, date: '2026-11-23' }));
    expect(screen.getByText('Continue')).toBeTruthy();
});

test('edit uses starting spoons, cancels a draft, and retries a failed save', async () => {
    const onSave = save().mockRejectedValueOnce(new Error('offline'));
    render(<SpoonOverview appearance={appearance} day={{ ...day, startingEnergy: 4, balance: 0 }} onSaveStartingEnergy={onSave} />);
    expect(screen.getByText(/Started with 4.*0 remaining/)).toBeTruthy();
    press('Edit Spoons');
    expect(screen.getByRole('button', { name: '4 spoons', selected: true })).toBeTruthy();
    press('2 spoons');
    press('Cancel');
    expect(onSave).not.toHaveBeenCalled();
    press('Edit Spoons');
    press('3 spoons');
    press('Save Changes');
    await screen.findByText('Retry');
    expect(screen.getByRole('button', { name: '3 spoons', selected: true })).toBeTruthy();
    press('Retry');
    await screen.findByText('Edit Spoons');
    expect(onSave.mock.calls).toEqual([[3], [3]]);
});
