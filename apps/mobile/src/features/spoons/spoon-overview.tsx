import { useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { MaxContentWidth } from '@/constants/theme';
import { AppButton } from '@/components/app-button';
import type { Appearance } from '@/features/settings/appearance';
import type { SpoonDay } from './contracts';

type SpoonOverviewProps = {
    day: SpoonDay | null;
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
        <View style={{ gap: onCancel ? 16 : 8 }}>
            <Text style={textStyle} accessibilityRole="header">
                {onCancel ? 'Edit spoons' : 'How many energy spoons do you have today?'} · {draft} of 5
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 4 }}>
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
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 4 }}>
                {onCancel && <View style={{ flexGrow: 1, flexBasis: 110 }}><AppButton appearance={appearance} label="Cancel" disabled={saving} onPress={onCancel} /></View>}
                <View style={{ flexGrow: 1, flexBasis: 140 }}><AppButton appearance={appearance} label={saving ? 'Saving…' : failed ? 'Retry' : onCancel ? 'Save Changes' : 'Continue'}
                    busy={saving} onPress={save} /></View>
            </View>
        </View>
    );
}

function DailyOverview({ day, appearance, onSaveStartingEnergy }: SpoonOverviewProps & { day: SpoonDay }) {
    const [editing, setEditing] = useState(false);
    const overview = useRef<View>(null);
    const [bounds, setBounds] = useState({ x: 0, y: 0, width: 0 });

    function measureOverview() {
        overview.current?.measureInWindow((x, y, width) => {
            if (width > 0) setBounds({ x, y, width });
        });
    }
    return (
        <View ref={overview} collapsable={false} onLayout={measureOverview} style={{ backgroundColor: appearance.colors.background, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth, padding: 20, gap: 16 }}>
            <Text style={{ color: appearance.colors.text, fontSize: 16 * appearance.fontScale }}>
                Today's Spoons · <Text style={{ fontWeight: 'bold' }}>{day.balance === null ? 'Not Recorded' : day.balance + ' Spoons'}</Text>
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 4 }}>
                {positions.map(position => <SpoonImage key={position} filled={position <= (day.balance ?? 0)} />)}
            </View>
            {day.startingEnergy !== null && day.balance !== day.startingEnergy && (
                <Text style={{ color: appearance.colors.textSecondary, fontSize: 16 * appearance.fontScale }}>Started with {day.startingEnergy} · {day.balance} remaining</Text>
            )}
            {day.startingEnergy !== null && <AppButton appearance={appearance} label="Edit Spoons" onPress={() => { measureOverview(); setEditing(true); }} />}
            {(editing || day.startingEnergy === null) && (
                <Modal transparent animationType={appearance.reduceMotion ? 'none' : 'fade'}>
                    <ScrollView style={{ backgroundColor: appearance.colors.textSecondary + '99' }}
                        contentContainerStyle={editing ? { paddingTop: Math.max(0, bounds.y) } : { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                        <View style={[{ backgroundColor: appearance.colors.background }, editing
                            ? { marginLeft: bounds.x, width: bounds.width || '100%', padding: 20 }
                            : { width: '100%', maxWidth: 440, borderRadius: 16, padding: 16 }]}>
                            <EnergyPicker appearance={appearance} initialEnergy={day.startingEnergy}
                                onCancel={editing ? () => setEditing(false) : undefined}
                                onSave={async amount => {
                                    await onSaveStartingEnergy(amount);
                                    setEditing(false);
                                }} />
                        </View>
                    </ScrollView>
                </Modal>
            )}
        </View>
    );
}

export function SpoonOverview(props: SpoonOverviewProps) {
    if (props.day === null) {
        return <Text accessibilityLiveRegion="polite" 
            style={{ color: props.appearance.colors.text,
                backgroundColor: props.appearance.colors.background, padding: 20, fontSize: 16 * props.appearance.fontScale }}>
                Loading today's spoons…
        </Text>;
    }
    return <DailyOverview key={props.day.date} {...props} day={props.day} />;
}

export default SpoonOverview;
