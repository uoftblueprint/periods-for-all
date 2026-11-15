import { useRef, type KeyboardEvent } from 'react';
import { Platform, View, type ViewProps } from 'react-native';

export function useRadioGroup<T>(values: readonly T[], value: T, onChange: (next: T) => void, disabled: boolean) {
  const choices = useRef<(View | null)[]>([]);
  return (index: number) => {
    const selected = values[index] === value;
    const tabIndex: ViewProps['tabIndex'] = Platform.OS === 'web' ? (selected && !disabled ? 0 : -1) : undefined;
    return {
      ref: (choice: View | null) => { choices.current[index] = choice; },
      accessibilityRole: 'radio' as const,
      disabled,
      tabIndex,
      'aria-checked': selected,
      accessibilityState: { checked: selected, disabled },
      onPress: () => onChange(values[index]),
      ...(Platform.OS === 'web' ? { onKeyDown: (event: KeyboardEvent) => {
        if (disabled) return;
        const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
          : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
        if (event.key !== ' ' && !direction) return;
        event.preventDefault();
        const next = (index + direction + values.length) % values.length;
        onChange(values[next]);
        if (direction) choices.current[next]?.focus();
      } } : {}),
    };
  };
}
