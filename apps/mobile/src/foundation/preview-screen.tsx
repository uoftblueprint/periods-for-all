import type { PropsWithChildren } from 'react';
import { ScrollView, Text } from 'react-native';

// Plain preview container, not the final product design system.
export function PreviewScreen({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 16, maxWidth: 700 }}>
      <Text accessibilityRole="header" style={{ fontSize: 24 }}>{title}</Text>
      {children}
    </ScrollView>
  );
}
