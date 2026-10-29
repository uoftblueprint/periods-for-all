import { useRef, type PropsWithChildren } from 'react';
import { AccessibilityInfo, Platform, ScrollView, Text } from 'react-native';
import type { Appearance } from '@/features/settings/appearance';

// Focus stays in presentation code, never in the gate's decisions.
export function focusHeading(target: Text | null) {
  if (!target) return;
  if (Platform.OS === 'web') target.focus();
  else AccessibilityInfo.sendAccessibilityEvent(target, 'focus');
}

export function PreviewScreen({ title, children, appearance, autoFocusTitle = false }: PropsWithChildren<{
  title: string;
  appearance?: Appearance;
  autoFocusTitle?: boolean;
}>) {
  const heading = useRef<Text>(null);
  const visible = useRef(false);
  return (
    <ScrollView
      style={appearance && { backgroundColor: appearance.colors.background }}
      contentContainerStyle={{ padding: 24, gap: 16, maxWidth: 700 }}
    >
      <Text
        ref={heading}
        tabIndex={-1}
        accessibilityRole="header"
        onLayout={({ nativeEvent: { layout } }) => {
          const shown = layout.width > 0 && layout.height > 0;
          if (shown && !visible.current && autoFocusTitle) focusHeading(heading.current);
          visible.current = shown;
        }}
        style={{ fontSize: 24 * (appearance?.fontScale ?? 1), color: appearance?.colors.text }}
      >{title}</Text>
      {children}
    </ScrollView>
  );
}
