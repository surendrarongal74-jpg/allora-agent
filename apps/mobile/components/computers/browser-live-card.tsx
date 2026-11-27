import { useLingui } from "@lingui/react/macro";
import type { PageView } from "@rakazo/contracts";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { rpc } from "../../lib/api/api";
import { mobileTokens } from "../../lib/appearance/appearance";
import { useAppForeground } from "../../lib/platform/app-foreground";

/** How often the card's still of the page is taken again while someone watches it. */
export const PAGE_VIEW_REFRESH_MS = 1500;

export function pageHost(url: string): string {
  const match = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i.exec(url);
  return match?.[1] ?? url;
}

/** Reads the bot's page again every `everyMs` while `enabled`, one read at a time. */
export function usePageView(botId: string, enabled: boolean, everyMs: number, large = false) {
  const [view, setView] = useState<PageView | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = async () => {
      try {
        const next = await rpc("computer/pageView", { botId, large });
        if (!cancelled) {
          setView(next);
          setFailed(false);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
      if (!cancelled) timer = setTimeout(() => void read(), everyMs);
    };
    void read();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [botId, enabled, everyMs, large]);
  return { view, setView, failed };
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
