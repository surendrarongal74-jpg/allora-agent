import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import { glassGradient } from "../../lib/appearance/glass";
import { useResolvedAppearance } from "../../lib/native/native";

/** The warm gradient the glass surfaces float over. Drawn once, behind everything, untouchable. */
export function GlassBackdrop() {
  const appearance = useResolvedAppearance();
  const { stops, glow, glowOpacity } = glassGradient(appearance);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="glass-backdrop" x1="0" y1="0" x2="0.35" y2="1">
            <Stop offset="0" stopColor={stops[0]} />
            <Stop offset="0.5" stopColor={stops[1]} />
            <Stop offset="1" stopColor={stops[2]} />
          </LinearGradient>
          <RadialGradient id="glass-backdrop-glow" cx="0.85" cy="0.12" rx="0.7" ry="0.45">
            <Stop offset="0" stopColor={glow} stopOpacity={glowOpacity} />
            <Stop offset="1" stopColor={glow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#glass-backdrop)" />
        <Rect width="100%" height="100%" fill="url(#glass-backdrop-glow)" />
      </Svg>
    </View>
  );
}
