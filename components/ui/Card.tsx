import { View, ViewProps, StyleSheet } from 'react-native';
import { Colors, Radius } from '@/constants/tokens';

interface CardProps extends ViewProps {
  level?: 1 | 2 | 3;
  border?: boolean;
  borderHot?: boolean;
  padding?: number;
}

export function KTCard({ level = 2, border = true, borderHot = false, padding = 16, style, children, ...props }: CardProps) {
  const bgs = { 1: Colors.bg1, 2: Colors.bg2, 3: Colors.bg3 };
  return (
    <View
      style={[
        {
          backgroundColor: bgs[level],
          borderRadius: Radius.md,
          padding,
          borderWidth: 1,
          borderColor: borderHot ? Colors.borderHot : border ? Colors.borderStrong : 'transparent',
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
