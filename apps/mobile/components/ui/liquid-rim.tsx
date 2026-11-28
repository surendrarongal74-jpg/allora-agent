import { useId, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { glassLight, glassRim } from "../../lib/appearance/glass";
import { useResolvedAppearance } from "../../lib/native/native";

/**
 * Liquid glass emulation where native glass is unavailable: a specular rim that is brightest at
 * the top-left and fades around the shape, plus a soft inner glow across the upper half.
 * Sits behind the surface's content and takes no touches.
 */
export function LiquidRim({
  shape = "capsule",
  cornerRadius = 22,
  radius: drawnRadius,
}: {
  shape?: "capsule" | "circle" | "roundedRectangle";
  cornerRadius?: number;
  /** The corner radius the surface is actually drawn with; wins over `shape`. */
  radius?: number;
}) {
  const appearance = useResolvedAppearance();
  const rim = glassRim(appearance);
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const radius = size
    ? drawnRadius !== undefined
      ? Math.min(drawnRadius, size.height / 2, size.width / 2)
      : shape === "roundedRectangle"
        ? Math.min(cornerRadius, size.height / 2, size.width / 2)
        : Math.min(size.height, size.width) / 2
    : 0;
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (!size || size.width !== width || size.height !== height) setSize({ width, height });
      }}
    >
      {size && size.width > 2 && size.height > 2 ? (
        <Svg width={size.width} height={size.height}>
          <Defs>
            <LinearGradient id={`rim${rawId}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={glassLight} stopOpacity={1} />
              <Stop offset="0.45" stopColor={glassLight} stopOpacity={0.15} />
              <Stop offset="1" stopColor={glassLight} stopOpacity={0.35} />
            </LinearGradient>
            <LinearGradient id={`glow${rawId}`} x1="0" y1="0" x2="0" y2="1">
              <Stop
                offset="0"
                stopColor={glassLight}
                stopOpacity={appearance === "dark" ? 0.1 : 0.32}
              />
              <Stop offset="0.55" stopColor={glassLight} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect
            x={0.5}
            y={0.5}
            width={size.width - 1}
            height={size.height - 1}
            rx={radius}
            ry={radius}
            fill={`url(#glow${rawId})`}
          />
          <Rect
            x={0.75}
            y={0.75}
            width={size.width - 1.5}
            height={size.height - 1.5}
            rx={Math.max(radius - 0.75, 0)}
            ry={Math.max(radius - 0.75, 0)}
            fill="none"
            stroke={`url(#rim${rawId})`}
            strokeOpacity={appearance === "dark" ? 0.45 : 0.95}
            strokeWidth={1.25}
          />
        </Svg>
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: drawnRadius ?? (shape === "roundedRectangle" ? cornerRadius : 999),
              borderWidth: 1,
              borderColor: rim.faint,
            },
          ]}
        />
      )}
    </View>
  );
}

/** The corner radius the fallback view is drawn with, so the emulated rim follows its edge. */
export function drawnRadius(
  style: StyleProp<ViewStyle>,
  fallbackStyle: StyleProp<ViewStyle>,
): number {
  const radius = StyleSheet.flatten([style, fallbackStyle])?.borderRadius;
  return typeof radius === "number" ? radius : 0;
}
