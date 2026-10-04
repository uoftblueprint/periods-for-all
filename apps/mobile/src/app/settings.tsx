import { useState } from 'react';
import { SettingsScreen } from '@/features/settings/settings-screen';
import { defaultSettings } from '@/foundation/contracts';
import { PreviewScreen } from '@/foundation/preview-screen';

export default function SettingsPreview() {
  const [settings, setSettings] = useState(defaultSettings);
  return (
    <PreviewScreen title="Settings preview (not saved)">
      <SettingsScreen settings={settings} onChange={setSettings} />
    </PreviewScreen>
  );
}
