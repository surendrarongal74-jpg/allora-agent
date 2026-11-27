import { useLingui } from "@lingui/react/macro";
import type { PageView } from "@rakazo/contracts";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Image, Pressable, Text, View } from "react-native";
import { mobileTokens } from "../../lib/appearance/appearance";
import { useAppForeground } from "../../lib/platform/app-foreground";
import { rpcQuery } from "../../lib/query/query";

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
    <View
      testID="browser-live-card"
      style={{
        marginTop: 12,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: tokens.border,
        backgroundColor: tokens.muted,
        paddingHorizontal: 14,
        paddingVertical: 12,
        maxWidth: 520,
        width: "100%",
      }}
    >
      <Text numberOfLines={1} style={{ color: tokens.mutedForeground, fontSize: 13 }}>
        {view?.url ? pageHost(view.url) : t`Browser`}
      </Text>
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
            borderRadius: 8,
            backgroundColor: tokens.background,
          }}
        />
      ) : (
        <View
          style={{
            marginTop: 8,
            width: "100%",
            aspectRatio: 16 / 10,
            borderRadius: 8,
            backgroundColor: tokens.background,
            opacity: 0.6,
          }}
        />
      )}
      <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text numberOfLines={1} style={{ flex: 1, color: tokens.foreground, fontSize: 13 }}>
          {step ?? ""}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: "/browser", params: { botId, name } })}
          style={{
            borderRadius: 999,
            borderWidth: 1,
            borderColor: tokens.border,
            paddingHorizontal: 12,
            paddingVertical: 6,
          }}
        >
          <Text style={{ color: tokens.foreground, fontSize: 13, fontWeight: "600" }}>
            {t`Take over`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
