import { useEffect } from "react";
import { View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { BUBBLE_RADIUS, glassSurfaceStyle } from "../../lib/appearance/glass";
import { useReduceMotion } from "../../lib/appearance/motion";
import { useMobileTokens, useResolvedAppearance } from "../../lib/native/native";
import { PopIn } from "../ui/enter-animation";

const DOT = 7;
const CYCLE_MS = 1200;
const HOP = 5;

/** Three dots bouncing in a glass bubble while the agent works on its reply. */
export function TypingBubble({ paused = false }: { paused?: boolean }) {
  const tokens = useMobileTokens();
  const appearance = useResolvedAppearance();
  const reduceMotion = useReduceMotion();
  const clock = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion || paused) return;
    clock.value = 0;
    clock.value = withRepeat(withTiming(1, { duration: CYCLE_MS, easing: Easing.linear }), -1);
    return () => cancelAnimation(clock);
  }, [clock, reduceMotion, paused]);
  return (
    <PopIn style={{ alignSelf: "flex-start", marginTop: 6 }}>
      <View
        testID="typing-bubble"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          ...glassSurfaceStyle(tokens, appearance),
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
          paddingHorizontal: 14,
          height: 36,
          borderRadius: BUBBLE_RADIUS,
          borderBottomLeftRadius: 8,
        }}
      >
        {([0, 1, 2] as const).map((slot) => (
          <Dot
            key={slot}
            slot={slot}
            clock={clock}
            still={reduceMotion}
            color={tokens.mutedForeground}
          />
        ))}
      </View>
    </PopIn>
  );
}

function Dot({
  slot,
  clock,
  still,
  color,
}: {
  slot: 0 | 1 | 2;
  clock: SharedValue<number>;
  still: boolean;
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    if (still) return { opacity: 0.7, transform: [{ translateY: 0 }] };
    // Each dot hops in turn during the first part of the cycle, then all rest.
    const phase = (clock.value - slot * 0.16 + 1) % 1;
    const hop = phase < 0.4 ? Math.sin((phase / 0.4) * Math.PI) : 0;
    return { opacity: 0.45 + 0.55 * hop, transform: [{ translateY: -HOP * hop }] };
  });
  return (
    <Animated.View
      style={[{ width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: color }, style]}
    />
  );
}
