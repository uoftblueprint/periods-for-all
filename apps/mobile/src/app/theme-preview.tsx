import { useState } from 'react';
import { Button, Text } from 'react-native';

import { ThemeStep } from '@/features/onboarding/theme-step';
import { defaultSettings, type Settings } from '@/foundation/contracts';
import { getAppearance } from '@/features/settings/appearance';
import { PreviewScreen } from '@/foundation/preview-screen';

export default function ThemePreview() {
    const [value, setValue] =
        useState<Settings['colorScheme']>('light');

    const appearance = {
    ...getAppearance({
        ...defaultSettings,
        colorScheme: value,
    }),
    fontScale: 1.75,
    };

    return (
        <PreviewScreen title="Theme Selection Preview">
        <ThemeStep
            value={value}
            onChange={setValue}
            appearance={appearance}
        />

        <Text>Selected theme: {value}</Text>
        <Button
            title="Force Default"
            onPress={() => setValue('light')}
        />

        <Button
            title="Force Dark Mode"
            onPress={() => setValue('dark')}
        />
        </PreviewScreen>
    );
}