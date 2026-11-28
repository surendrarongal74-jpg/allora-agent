import { View } from "react-native";
import { BUBBLE_RADIUS } from "../../lib/appearance/glass";

/**
 * The glossy highlight across the top of your own bubble. Faint enough (8% white) that white
 * text over it stays above 4.5:1 on the brand orange.
 */
export function BubbleGloss({ radius = BUBBLE_RADIUS }: { radius?: number }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "50%",
        borderTopLeftRadius: radius,
        borderTopRightRadius: radius,
        backgroundColor: "rgba(255, 255, 255, 0.08)",
      }}
    />
  );
}
