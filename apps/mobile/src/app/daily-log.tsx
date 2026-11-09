// S3-08: real route for one day's log. The screen itself is S3-06's.
import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { parseDate } from '@/features/calendar/calendar-dates';
import { DailyLogScreen, RequireHealthStore, leaveToCalendar, localToday } from '@/features/health/health-routes';
import { getAppearance } from '@/features/settings/appearance';
import { useSettings } from '@/features/settings/settings-provider';
import { PreviewScreen } from '@/foundation/preview-screen';

export default function DailyLogRoute() {
  const appearance = getAppearance(useSettings().settings);
  const [today] = useState(localToday);
  // The URL holds only the date (e.g. /daily-log?date=2026-11-08), never health answers.
  const params = useLocalSearchParams<{ date?: string }>();
  const date = typeof params.date === 'string' ? params.date : '';
  const text = { color: appearance.colors.text, fontSize: 16 * appearance.fontScale };

  if (!parseDate(date) || date > today) {
    return (
      <PreviewScreen title="Daily log" appearance={appearance}>
        <View>
          <Text accessibilityRole="alert" style={text}>This day can’t be logged.</Text>
          <AppButton appearance={appearance} label="Back to calendar" onPress={leaveToCalendar} />
        </View>
      </PreviewScreen>
    );
  }

  return (
    <PreviewScreen title="Daily log" appearance={appearance}>
      <RequireHealthStore appearance={appearance}>
        {(store, userId) => (
          <DailyLogScreen
            // A different account remounts the screen, clearing its in-memory answers.
            key={userId}
            date={date}
            today={today}
            store={store}
            appearance={appearance}
            // The screen finishes or resolves pending saves before calling these.
            onDateChange={(next) => router.setParams({ date: next })}
            onExit={leaveToCalendar}
          />
        )}
      </RequireHealthStore>
    </PreviewScreen>
  );
}
