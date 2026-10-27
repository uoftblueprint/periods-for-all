import type { Settings } from '../../foundation/contracts';
import type { Appearance } from '../settings/appearance';
import { View,Text, Pressable } from 'react-native';

export interface ThemeStepProps {
  value: Settings['colorScheme'];
  onChange: (value: Settings['colorScheme']) => void;
  appearance: Appearance;
}

type ColorScheme = Settings['colorScheme'];

// using themeOptions, we can map over it to create a button for each theme
// when a new theme is needed/added, we can simply update this array rather than creating another button component
const themeOptions: {
  value: ColorScheme;
  label: string;
}[] = [
  { value: 'light', label: 'Default' },
  // { value: 'highContrast', label: 'High Contrast' }, commented out for now since its not a proper type/value yet
  { value: 'dark', label: 'Dark Mode' },
];

export function ThemeStep(props:ThemeStepProps){
  //backgroundColor to handle cases where Dark Mode results in the white text not being readable since the background is also white
  return <View style={{backgroundColor: props.appearance.colors.background,}}> 
    {/*mapping over all the themes and creating Pressables*/}
    {themeOptions.map((theme) => (
        <Pressable 
          key={theme.value}
          onPress={() => props.onChange(theme.value)}
          accessibilityRole="radio"
          aria-checked={props.value === theme.value} // for web version
          accessibilityState={{
            checked: props.value === theme.value,
          }}
          accessibilityLabel={theme.label}
          style={{
            backgroundColor: props.appearance.colors.backgroundElement,
            marginVertical: 5,
            padding: 16,
            borderWidth: props.value === theme.value ? 3 : 1,
            borderColor: props.value === theme.value ? props.appearance.colors.text: props.appearance.colors.textSecondary,
            borderRadius: 8,
          }}
        >
          <View
            style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            }}>
              <Text style={{
                  color: props.appearance.colors.text,
                  fontSize: 16 * props.appearance.fontScale,
                  flex: 1,
                }}>
                {theme.label}
              </Text>
            {/*separated the checkmark from the label so that the checkmark is able to wrap properly*/}
            {props.value === theme.value && (
              <Text style={{
                  color: props.appearance.colors.text,
                  fontSize: 16 * props.appearance.fontScale,
                }}>
                ✓
              </Text>
            )}
          </View>
        </Pressable>
      ))}
  </View>
}

