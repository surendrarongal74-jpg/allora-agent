import type { ReactNode } from "react";
import { useState } from "react";
import type { PressableProps, StyleProp, ViewStyle } from "react-native";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { glassLight } from "../../lib/appearance/glass";
import { useReduceMotion } from "../../lib/appearance/motion";

/** The springy squish of a liquid glass control: wider and shorter under the finger. */
const PRESS_SPRING = { damping: 12, stiffness: 320, mass: 0.6 } as const;
const RELEASE_SPRING = { damping: 9, stiffness: 260, mass: 0.6 } as const;
const SWEEP_MS = 520;

export type LiquidPressableProps = Omit<PressableProps, "style" | "children"> & {
  style?: StyleProp<ViewStyle>;
  /** Corner radius the light sweep is clipped to; 999 for a pill or circle. */
  sweepRadius?: number;
  /** How far the control stretches when pressed (0.06 = 6%). */
  stretch?: number;
  children?: ReactNode;
};

/**
 * A pressable that morphs like liquid glass: it stretches on press with a spring, bounces back on
 * release, and a band of light sweeps across it. With reduce motion it only dims while pressed.
 */
export function LiquidPressable({
  style,
  sweepRadius = 999,
  stretch = 0.06,
  children,
  onPressIn,
  onPressOut,
  ...props
}: LiquidPressableProps) {
  const reduceMotion = useReduceMotion();
  const press = useSharedValue(0);
  const sweep = useSharedValue(-1);
  const [width, setWidth] = useState(0);
  const bodyStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 1 - press.value * 0.3 : 1,
    transform: reduceMotion
      ? []
      : [{ scaleX: 1 + press.value * stretch }, { scaleY: 1 - press.value * stretch }],
  }));
  const sweepStyle = useAnimatedStyle(() => ({
    opacity: sweep.value <= -1 || sweep.value >= 1 ? 0 : 1,
    transform: [{ translateX: sweep.value * Math.max(width, 1) }],
  }));
  return (
    <Pressable
      {...props}
      style={style}
      onPressIn={(event) => {
        if (reduceMotion) press.value = 1;
        else {
          press.value = withSpring(1, PRESS_SPRING);
          sweep.value = withSequence(
            withTiming(-1, { duration: 0 }),
            withTiming(1, { duration: SWEEP_MS, easing: Easing.out(Easing.quad) }),
          );
        }
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        press.value = reduceMotion ? 0 : withSpring(0, RELEASE_SPRING);
        onPressOut?.(event);
      }}
    >
      <Animated.View
        style={bodyStyle}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      >
        {children}
        {reduceMotion ? null : (
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { borderRadius: sweepRadius, overflow: "hidden" }]}
          >
            <Animated.View style={[StyleSheet.absoluteFill, sweepStyle]}>
              <Svg width="100%" height="100%">
                <Defs>
                  <LinearGradient id="liquid-sweep" x1="0" y1="0" x2="1" y2="0.3">
                    <Stop offset="0.2" stopColor={glassLight} stopOpacity={0} />
                    <Stop offset="0.5" stopColor={glassLight} stopOpacity={0.45} />
                    <Stop offset="0.8" stopColor={glassLight} stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" fill="url(#liquid-sweep)" />
              </Svg>
            </Animated.View>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}
