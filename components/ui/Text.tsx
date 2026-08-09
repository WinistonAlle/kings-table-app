import { Text as RNText, TextProps, StyleSheet } from 'react-native';
import { Colors, Fonts } from '@/constants/tokens';

interface KTTextProps extends TextProps {
  variant?: 'display' | 'displayItalic' | 'ui' | 'uiMedium' | 'uiSemiBold' | 'uiBold' | 'mono' | 'monoMedium' | 'monoBold' | 'label';
  color?: string;
  size?: number;
}

export function KTText({ variant = 'ui', color, size, style, ...props }: KTTextProps) {
  const fontFamily = Fonts[variant === 'label' ? 'uiSemiBold' : variant] ?? Fonts.ui;
  const defaultColor = color ?? Colors.text0;
  const letterSpacing = variant === 'label' ? 1.8 : undefined;
  const textTransform = variant === 'label' ? 'uppercase' as const : undefined;
  const fontSize = variant === 'label' ? 10 : (size ?? 16);

  return (
    <RNText
      style={[
        { fontFamily, color: defaultColor, fontSize, letterSpacing, textTransform },
        style,
      ]}
      {...props}
    />
  );
}
