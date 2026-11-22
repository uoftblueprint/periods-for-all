import { useState } from 'react';
import { getAppearance } from '@/features/settings/appearance';
import { useSettings } from '@/features/settings/settings-provider';
import type { SpoonDay } from '@/features/spoons/contracts';
import { SpoonOverview } from '@/features/spoons/spoon-overview';

export default function SpoonPreview() {
  const appearance = getAppearance(useSettings().settings);
  const [day, setDay] = useState<SpoonDay>({
    date: '2023-06-01',
    startingEnergy: null,
    balance: null,
    revision: 1,
    tasks: [],
    effects: [],
  });

  return <SpoonOverview appearance={appearance} day={day} onSaveStartingEnergy={async amount => {
    setDay(previous => ({ ...previous, startingEnergy: amount, balance: amount, revision: previous.revision + 1 }));
  }} />;
}
