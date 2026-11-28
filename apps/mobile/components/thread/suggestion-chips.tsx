import { useLingui } from "@lingui/react/macro";
import { ScrollView, Text } from "react-native";
import { useMobileTokens } from "../../lib/native/native";
import { GlassSurface } from "../native/glass-surface";
import { PopIn } from "../ui/enter-animation";
import { LiquidPressable } from "../ui/liquid-pressable";

/** Glass chips with a few things to ask, shown above the composer in an empty chat. */
export function SuggestionChips({ onPick }: { onPick: (text: string) => void }) {
  const { t } = useLingui();
  const tokens = useMobileTokens();
  const suggestions = [
    t`Search the web for today's top news`,
    t`Open a website and summarize it`,
    t`Plan my day`,
    t`Draft a quick email`,
  ];
  return (
    <PopIn>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 8, paddingVertical: 6 }}
      >
        {suggestions.map((text) => (
          <LiquidPressable
            key={text}
            accessibilityRole="button"
            accessibilityLabel={text}
            onPress={() => onPick(text)}
          >
            <GlassSurface
              style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 }}
              fallbackStyle={{
                backgroundColor: tokens.glassFill,
                borderWidth: 1,
                borderColor: tokens.glassStroke,
              }}
            >
              <Text style={{ color: tokens.foreground, fontSize: 14 }}>{text}</Text>
            </GlassSurface>
          </LiquidPressable>
        ))}
      </ScrollView>
    </PopIn>
  );
}
