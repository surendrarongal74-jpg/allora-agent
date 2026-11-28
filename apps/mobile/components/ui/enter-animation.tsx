import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useReduceMotion } from "../../lib/appearance/motion";

const ENTER_MS = 280;

/**
 * Slides its content up into place and fades it in, once, on mount. `inverted` is for rows of an
 * inverted list, whose transforms are mirrored. Holds still with reduce motion or `animate` off.
 */
export function SlideUpFadeIn({
  animate = true,
  inverted = false,
  distance = 14,
  style,
  children,
}: {
  animate?: boolean;
  inverted?: boolean;
  distance?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const reduceMotion = useReduceMotion();
  // Decided once, on mount: a row that re-renders later never replays or cuts its entrance.
  const [moving] = useState(animate && !reduceMotion);
  const progress = useSharedValue(moving ? 0 : 1);
  useEffect(() => {
    if (moving)
      progress.value = withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
  }, [moving, progress]);
  const offset = inverted ? -distance : distance;
  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * offset }],
  }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/** Fades and scales a card in from 96%, with a soft spring. */
export function PopIn({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withSpring(1, { damping: 16, stiffness: 180 });
  }, [reduceMotion, progress]);
  const animated = useAnimatedStyle(() => ({
    opacity: Math.min(progress.value, 1),
    transform: [{ scale: 0.96 + 0.04 * progress.value }],
  }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
