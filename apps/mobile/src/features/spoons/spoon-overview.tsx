import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { AppButton } from '@/components/app-button';
import type { Appearance } from '@/features/settings/appearance';
import type { SpoonDay } from './contracts';

type SpoonOverviewProps = {
    day: SpoonDay;
    appearance: Appearance;
    onSaveStartingEnergy: (amount: number) => Promise<void>;
};

const fullSpoon = require('../../../assets/images/spoon-full.png');
const emptySpoon = require('../../../assets/images/spoon-empty.png');
const positions = [1, 2, 3, 4, 5];

function SpoonImage({ filled }: { filled: boolean }) {
    return <Image source={filled ? fullSpoon : emptySpoon} accessible={false}
        resizeMode="contain" style={{ width: 48, height: 48, flexShrink: 1 }} />;
}

type EnergyPickerProps = {
    appearance: Appearance;
    initialEnergy: number | null;
    onSave: SpoonOverviewProps['onSaveStartingEnergy'];
    onCancel?: () => void;
};

function EnergyPicker({ appearance, initialEnergy, onSave, onCancel }: EnergyPickerProps) {
    const [draft, setDraft] = useState(initialEnergy ?? 0);
    const [saving, setSaving] = useState(false);
    const [failed, setFailed] = useState(false);
    const textStyle = { color: appearance.colors.text, fontSize: 16 * appearance.fontScale };

    async function save() {
        if (saving) return;
        setSaving(true);
        setFailed(false);
        try {
            await onSave(draft);
        } catch {
            setFailed(true);
        } finally {
            setSaving(false);
        }
    }

    return (
        <View style={{ gap: 8 }}>
            <Text style={textStyle} accessibilityRole="header">
                {onCancel ? 'Edit starting spoons' : 'How many energy spoons do you have today?'} · {draft} of 5
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {positions.map(amount => (
                    <Pressable key={amount} disabled={saving} accessibilityRole="button"
                        accessibilityLabel={amount === 1 ? '1 spoon' : amount + ' spoons'}
                        accessibilityHint={draft === amount ? 'Tap again to select zero spoons' : undefined}
                        accessibilityState={{ selected: draft === amount, disabled: saving }}
                        onPress={() => setDraft(draft === amount ? 0 : amount)}>
                        <SpoonImage filled={amount <= draft} />
                    </Pressable>
                ))}
            </View>
            {failed && <Text style={textStyle} accessibilityRole="alert">Couldn't save your spoons. Try again.</Text>}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {onCancel && <AppButton appearance={appearance} label="Cancel" disabled={saving} onPress={onCancel} />}
                <AppButton appearance={appearance} label={saving ? 'Saving…' : failed ? 'Retry' : onCancel ? 'Save Changes' : 'Continue'}
                    busy={saving} onPress={save} />
            </View>
        </View>
    );
}

function DailyOverview({ day, appearance, onSaveStartingEnergy }: SpoonOverviewProps) {
    const [editing, setEditing] = useState(false);
    return (
        <View style={{ backgroundColor: appearance.colors.background, gap: 8 }}>
            {editing ? (
                <EnergyPicker appearance={appearance} initialEnergy={day.startingEnergy}
                    onCancel={() => setEditing(false)} onSave={async amount => {
                        await onSaveStartingEnergy(amount);
                        setEditing(false);
                    }} />
            ) : (
                <>
                    <Text style={{ color: appearance.colors.text, fontSize: 16 * appearance.fontScale }}>
                        Today's Spoons · {day.balance === null ? 'Not Recorded' : day.balance + ' Spoons'}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {positions.map(position => <SpoonImage key={position} filled={position <= (day.balance ?? 0)} />)}
                    </View>
                    {day.startingEnergy !== null && <AppButton appearance={appearance} label="Edit Spoons" onPress={() => setEditing(true)} />}
                </>
            )}
            {day.startingEnergy === null && (
                <Modal transparent animationType={appearance.reduceMotion ? 'none' : 'fade'}>
                    <ScrollView style={{ backgroundColor: appearance.colors.textSecondary + '99' }}
                        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                        <View style={{ backgroundColor: appearance.colors.background, width: '100%', maxWidth: 440, borderRadius: 16, padding: 16 }}>
                            <EnergyPicker appearance={appearance} initialEnergy={null} onSave={onSaveStartingEnergy} />
                        </View>
                    </ScrollView>
                </Modal>
            )}
        </View>
    );
}

export function SpoonOverview(props: SpoonOverviewProps) {
    return <DailyOverview key={props.day.date} {...props} />;
}

export default SpoonOverview;
