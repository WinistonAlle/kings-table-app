import { TouchableOpacity, View, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Colors, Fonts, Radius } from '@/constants/tokens';
import { KTText } from './Text';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'gold' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function KTButton({ label, onPress, variant = 'gold', size = 'md', disabled, fullWidth, style }: ButtonProps) {
  const heights = { sm: 36, md: 48, lg: 56 };
  const fontSizes = { sm: 13, md: 15, lg: 16 };
  const paddingH = { sm: 16, md: 24, lg: 28 };

  const bgStyles: Record<string, ViewStyle> = {
    gold: {
      backgroundColor: Colors.gold200,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.35,
      shadowRadius: 4,
    },
    ghost: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: Colors.borderStrong,
    },
    danger: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: Colors.danger,
    },
  };

  const textColors: Record<string, string> = {
    gold:   '#1a1206',
    ghost:  Colors.text0,
    danger: Colors.danger,
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[
        {
          height: heights[size],
          paddingHorizontal: paddingH[size],
          borderRadius: Radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.4 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        bgStyles[variant],
        style,
      ]}
    >
      <KTText
        variant="uiSemiBold"
        size={fontSizes[size]}
        color={textColors[variant]}
      >
        {label}
      </KTText>
    </TouchableOpacity>
  );
}
