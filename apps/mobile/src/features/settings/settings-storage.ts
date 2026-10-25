import type {Settings} from '@/foundation/contracts';
import 'expo-sqlite/localStorage/install';

const SETTINGS_KEY = 'accessibility-settings'

// check the validity of a settings
function isValidSetting(settings: unknown): settings is Settings{
    // instead of having many if statements, we will check if the setting is contained in the list of valid settings
    // also makes it slightly more maintainable; easier to simply add it to the list rather than making super long if statements checks
    const validTextSizes = ['standard', 'large'];
    const validColorSchemes = ['light', 'dark'];
    // no need for a list for reduceMotion since it is simply a boolean so we just have to check its type
    if(typeof settings !== "object" || settings === null){
        return false;
    }

    // same idea as validTextSizes, if new keys are added later on we can simply update our list
    const validKeys = ['textSize','colorScheme','reduceMotion'];

    if(
        !Object.keys(settings).every(
        key => validKeys.includes(key)
    )
    ) {return false;}

    //checking if textSize is valid
    if(
        !("textSize" in settings) ||
        typeof settings.textSize !== "string" ||
        !(validTextSizes.includes(settings.textSize))
    ){return false;}

    //checking if colorScheme is valid
    if(
        !("colorScheme" in settings) ||
        typeof settings.colorScheme !== "string" ||
        !(validColorSchemes.includes(settings.colorScheme))
    ){return false;}

    //checking if reduceMotion is valid
    if(
        !("reduceMotion" in settings) ||
        typeof settings.reduceMotion !== "boolean"
    ){return false;}

    return true;
}

export async function loadSettings(): Promise<Settings|null>{
    const settings = localStorage.getItem(SETTINGS_KEY);

    if(settings === null){
        return null;
    }

    let parsed: unknown;
    try{
        parsed = JSON.parse(settings);

    }catch{
        throw new Error("Invalid settings");
    }

    if(!isValidSetting(parsed)){ // check if it's format/fields are valid
        throw new Error("Invalid settings");
    }

    return parsed;
}

export async function saveSettings(settings: Settings): Promise<void>{
    const serialized = JSON.stringify(settings);
    localStorage.setItem(SETTINGS_KEY, serialized);
}
