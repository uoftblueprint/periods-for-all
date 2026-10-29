import {defaultSettings, type Settings} from '@/foundation/contracts';
import {normalizeSettings} from '@/features/settings/normalize-settings';
import 'expo-sqlite/localStorage/install';

const SETTINGS_KEY = 'accessibility-settings'

export async function loadSettings(): Promise<Settings|null>{
    const settings = localStorage.getItem(SETTINGS_KEY);

    if(settings === null){
        return null;
    }

    let parsed: unknown;
    try{
        parsed = JSON.parse(settings);

    }catch{
        return {...defaultSettings}; // corrupt JSON: fall back instead of crashing
    }

    return normalizeSettings(parsed); // bad or missing fields fall back to defaults
}

export async function saveSettings(settings: Settings): Promise<void>{
    const serialized = JSON.stringify(settings);
    localStorage.setItem(SETTINGS_KEY, serialized);
}
