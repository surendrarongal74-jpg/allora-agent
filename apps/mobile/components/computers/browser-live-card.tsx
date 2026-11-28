import { useLingui } from "@lingui/react/macro";
import type { PageView } from "@rakazo/contracts";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Image, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { mobileTokens, resolveMobileAppearance } from "../../lib/appearance/appearance";
import { BUBBLE_RADIUS, glassBrand, glassSurfaceStyle } from "../../lib/appearance/glass";
import { useReduceMotion } from "../../lib/appearance/motion";
import { useAppForeground } from "../../lib/platform/app-foreground";
import { rpcQuery } from "../../lib/query/query";
import { GlassSurface } from "../native/glass-surface";
import { PopIn } from "../ui/enter-animation";
import { LiquidPressable } from "../ui/liquid-pressable";

/** How often the card's still of the page is taken again while someone watches it. */
export const PAGE_VIEW_REFRESH_MS = 1500;

export function pageHost(url: string): string {
  const match = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i.exec(url);
  return match?.[1] ?? url;
}

/** Reads the bot's page again every `everyMs` while `enabled`, like the live screen. */
export function usePageView(botId: string, enabled: boolean, everyMs: number, large = false) {
  const view = useQuery({
    ...rpcQuery("computer/pageView", { botId, large }),
    enabled: enabled && Boolean(botId),
    refetchInterval: enabled ? everyMs : false,
    retry: false,
    gcTime: 0,
  });
  return { view: (view.data as PageView | undefined) ?? null, failed: view.isError };
}

/** The page the bot is using, live, with what it is doing there and a way to take it over. */
export function BrowserLiveCard({
  botId,
  name,
  step,
}: {
  botId: string;
  name?: string;
  step?: string | null;
}) {
  const { t } = useLingui();
  const tokens = mobileTokens();
  const router = useRouter();
  const foreground = useAppForeground();
  const { view, failed } = usePageView(botId, foreground, PAGE_VIEW_REFRESH_MS);
  if (failed && !view?.image) return null;
  return (
    <PopIn style={{ marginTop: 12, maxWidth: 520, width: "100%" }}>
      <View
        testID="browser-live-card"
        style={{
          ...glassSurfaceStyle(tokens, resolveMobileAppearance()),
          borderRadius: BUBBLE_RADIUS,
          paddingHorizontal: 14,
          paddingVertical: 12,
          width: "100%",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <LiveDot />
          <Text style={{ color: tokens.foreground, fontSize: 12, fontWeight: "700" }}>
            {t`Live`}
          </Text>
          <Text numberOfLines={1} style={{ flex: 1, color: tokens.mutedForeground, fontSize: 13 }}>
            {view?.url ? pageHost(view.url) : t`Browser`}
          </Text>
        </View>
        {view?.image ? (
          <Image
            source={{ uri: view.image }}
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            style={{
              marginTop: 8,
              width: "100%",
              aspectRatio: view.viewport ? view.viewport.width / view.viewport.height : 16 / 10,
              maxHeight: 360,
              borderRadius: 14,
              backgroundColor: tokens.background,
            }}
          />
        ) : (
          <View
            style={{
              marginTop: 8,
              width: "100%",
              aspectRatio: 16 / 10,
              borderRadius: 14,
              backgroundColor: tokens.background,
              opacity: 0.6,
            }}
          />
        )}
        <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text numberOfLines={1} style={{ flex: 1, color: tokens.foreground, fontSize: 13 }}>
            {step ?? ""}
          </Text>
          <LiquidPressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: "/browser", params: { botId, name } })}
          >
            <GlassSurface
              tint={glassBrand.fill}
              style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 }}
              fallbackStyle={{ backgroundColor: glassBrand.fill }}
            >
              <Text style={{ color: glassBrand.foreground, fontSize: 13, fontWeight: "600" }}>
                {t`Take over`}
              </Text>
            </GlassSurface>
          </LiquidPressable>
        </View>
      </View>
    </PopIn>
  );
}

const PULSE_MS = 1100;

/** The red-orange dot that gently pulses while the page is live. Still with reduce motion. */
function LiveDot() {
  const reduceMotion = useReduceMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(
      withTiming(1, { duration: PULSE_MS, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion]);
  const halo = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 1.4 }],
  }));
  return (
    <View style={{ width: 10, height: 10, alignItems: "center", justifyContent: "center" }}>
      {reduceMotion ? null : (
        <Animated.View
          style={[
            {
              position: "absolute",
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: glassBrand.accent,
            },
            halo,
          ]}
        />
      )}
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: glassBrand.accent }} />
    </View>
  );
}
