import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

interface AccessibleButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
}

export function AccessibleButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
  accessibilityHint,
}: AccessibleButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          variant === 'outline' ? styles.outlineText : styles.solidText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: '#0B5D4B',
  },
  secondary: {
    backgroundColor: '#134E8E',
  },
  outline: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#0B5D4B',
  },
  danger: {
    backgroundColor: '#9E2A2B',
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  solidText: {
    color: '#FFFFFF',
  },
  outlineText: {
    color: '#0B5D4B',
  },
});
