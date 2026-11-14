// S3-08: real route for editing period dates. The editor itself is S3-03's.
import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { parseMonth } from '@/features/calendar/calendar-dates';
import {
  PeriodDateEditor, RequireHealthStore, leaveToCalendar, localToday, useLoad, visibleRange, type HealthStore,
} from '@/features/health/health-routes';
import { getAppearance, type Appearance } from '@/features/settings/appearance';
import { useSettings } from '@/features/settings/settings-provider';
import { PreviewScreen } from '@/foundation/preview-screen';

export default function PeriodEditRoute() {
  const appearance = getAppearance(useSettings().settings);
  const params = useLocalSearchParams<{ month?: string }>();
  const month = typeof params.month === 'string' ? params.month : '';
  return (
    <PreviewScreen title="Edit Period Dates" appearance={appearance}>
      <RequireHealthStore appearance={appearance}>
        {(store, userId) => <PeriodEditContent key={userId} store={store} month={month} appearance={appearance} />}
      </RequireHealthStore>
    </PreviewScreen>
  );
}

function PeriodEditContent({ store, month, appearance }: { store: HealthStore; month: string; appearance: Appearance }) {
  const [today] = useState(localToday);
  // A missing or invalid month opens the current month.
  const initialMonth = parseMonth(month) ? month : today.slice(0, 7);
  const range = visibleRange(initialMonth);
  const saved = useLoad(initialMonth, () => store.getPeriodDays(range.from, range.to));
  const text = { color: appearance.colors.text, fontSize: 16 * appearance.fontScale };

  if (saved.status === 'loading') {
    return (
      <View>
        <ActivityIndicator accessibilityLabel="Loading your period dates" />
        <Text accessibilityLiveRegion="polite" style={text}>Loading your period dates…</Text>
      </View>
    );
  }
  if (saved.status === 'error') {
    // Editing from a failed load could wrongly "remove" days, so don't open the editor.
    return (
      <View>
        <Text accessibilityRole="alert" style={text}>We couldn’t load your period dates.</Text>
        <AppButton appearance={appearance} label="Try again" onPress={saved.retry} />
        <AppButton appearance={appearance} label="Back to calendar" onPress={leaveToCalendar} />
      </View>
    );
  }
  return (
    <PeriodDateEditor
      initialDates={saved.data}
      initialMonth={initialMonth}
      today={today}
      appearance={appearance}
      loadDates={(from, to) => store.getPeriodDays(from, to)}
      onSave={(change) => store.updatePeriodDays(change)}
      // The calendar reloads its marks when it is shown again.
      onDone={leaveToCalendar}
      onCancel={leaveToCalendar}
    />
  );
}
