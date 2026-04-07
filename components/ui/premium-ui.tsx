import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  glowColor?: string;
  intensity?: number;
  fill?: boolean;
}

interface ShimmerBlockProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export function GlassCard({
  children,
  style,
  contentStyle,
  glowColor = 'rgba(56,189,248,0.22)',
  intensity = 38,
  fill = false,
}: GlassCardProps) {
  return (
    <View style={[styles.glassOuter, { shadowColor: glowColor }, style]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.05)', 'rgba(56,189,248,0.12)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.glassBorder, fill && styles.glassBorderFill]}
      >
        <BlurView intensity={intensity} tint="dark" style={[styles.glassInner, fill && styles.glassInnerFill, contentStyle]}>
          {children}
        </BlurView>
      </LinearGradient>
    </View>
  );
}

export function ShimmerBlock({
  width = '100%',
  height = 14,
  borderRadius = 12,
  style,
}: ShimmerBlockProps) {
  const translateX = useSharedValue(-180);

  useEffect(() => {
    translateX.value = withRepeat(withTiming(220, { duration: 1250 }), -1, false);
  }, [translateX]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View
      style={[
        styles.shimmerBase,
        {
          width,
          height,
          borderRadius,
        },
        style,
      ]}
    >
      <Animated.View style={[styles.shimmerOverlay, shimmerStyle]}>
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(148,163,184,0.22)', 'rgba(255,255,255,0.05)', 'rgba(0,0,0,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.shimmerGradient}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  glassOuter: {
    borderRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 12,
  },
  glassBorder: {
    borderRadius: 24,
    padding: 1,
    overflow: 'hidden',
  },
  glassBorderFill: {
    flex: 1,
  },
  glassInner: {
    borderRadius: 23,
    backgroundColor: 'rgba(5,10,20,0.78)',
  },
  glassInnerFill: {
    flex: 1,
  },
  shimmerBase: {
    overflow: 'hidden',
    backgroundColor: 'rgba(30,41,59,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 180,
  },
  shimmerGradient: {
    flex: 1,
  },
});
