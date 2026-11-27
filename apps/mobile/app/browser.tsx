import { useLingui } from "@lingui/react/macro";
import type { PageInput, PageView } from "@rakazo/contracts";
import { COMPUTER_CONTROL_HEARTBEAT_MS } from "@rakazo/core";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GestureResponderEvent, LayoutChangeEvent, TextInputInstance } from "react-native";
import { ActivityIndicator, Image, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePageView } from "../components/computers/browser-live-card";
import { rpc } from "../lib/api/api";
import { errorText } from "../lib/api/user-error";
import { mobileTokens } from "../lib/appearance/appearance";
import { useAppForeground } from "../lib/platform/app-foreground";

const TAKEOVER_REFRESH_MS = 1000;
const SWIPE_PX = 10;
const PHONE_VIEWPORT = { width: 390, height: 844 };

/** Where a point on the shown still falls on the page, in its CSS pixels. */
function pagePoint(
  local: { x: number; y: number },
  box: { width: number; height: number },
  viewport: { width: number; height: number },
) {
  return {
    x: Math.max(0, Math.round((local.x / Math.max(1, box.width)) * viewport.width)),
    y: Math.max(0, Math.round((local.y / Math.max(1, box.height)) * viewport.height)),
  };
}

/**
 * The bot's page full screen, like a phone browser: the person taps, swipes and types into the
 * same tab the bot uses, then hands it back. Taking over and handing back reuse the computer's
 * control lease, as the web does.
 */
export default function Browser() {
  const { t } = useLingui();
  const tokens = mobileTokens();
  const router = useRouter();
  const foreground = useAppForeground();
  const { botId = "" } = useLocalSearchParams<{ botId?: string; name?: string }>();
  const [leaseId, setLeaseId] = useState<string | null>(null);
  const [latest, setLatest] = useState<PageView | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [typing, setTyping] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [box, setBox] = useState({ width: 1, height: 1 });
  const press = useRef<{ x: number; y: number } | null>(null);
  const keyboard = useRef<TextInputInstance>(null);
  // Inputs go one at a time, in order, like keys on a keyboard.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const lease = useRef<string | null>(null);

  const send = useCallback(
    (input: PageInput) => {
      queue.current = queue.current.then(async () => {
        try {
          setLatest(await rpc("computer/pageInput", { botId, input }));
          setError(null);
        } catch (failure) {
          setError(errorText(failure, t`That did not reach the page`));
        }
      });
      return queue.current;
    },
    [botId, t],
  );

  useEffect(() => {
    if (!botId) return;
    let cancelled = false;
    void (async () => {
      try {
        const taken = await rpc("computer/takeover", { botId });
        if (cancelled) {
          await rpc("computer/release", { botId, leaseId: taken.leaseId }).catch(() => {});
          return;
        }
        lease.current = taken.leaseId;
        setLeaseId(taken.leaseId);
        setLatest(await rpc("computer/pageInput", { botId, input: { kind: "phone" } }));
      } catch (failure) {
        if (!cancelled) setError(errorText(failure, t`Could not take over`));
      }
    })();
    return () => {
      cancelled = true;
      // Leaving the screen any way hands the page back.
      const held = lease.current;
      lease.current = null;
      if (held) {
        void rpc("computer/pageInput", { botId, input: { kind: "desktop" } })
          .catch(() => {})
          .then(() => rpc("computer/release", { botId, leaseId: held }))
          .catch(() => {});
      }
    };
  }, [botId, t]);

  // Control lapses unless the screen checks in while it is open.
  useEffect(() => {
    if (!leaseId || !foreground) return;
    const timer = setInterval(() => {
      void rpc("computer/heartbeat", { botId }).catch(() => {});
    }, COMPUTER_CONTROL_HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [botId, leaseId, foreground]);

  const { view } = usePageView(botId, Boolean(leaseId) && foreground, TAKEOVER_REFRESH_MS, true);
  const page = view ?? latest;
  const viewport = page?.viewport ?? PHONE_VIEWPORT;

  const handBack = async () => {
    await queue.current;
    const held = lease.current;
    lease.current = null;
    if (held) {
      await rpc("computer/pageInput", { botId, input: { kind: "desktop" } }).catch(() => {});
      await rpc("computer/release", { botId, leaseId: held }).catch(() => {});
    }
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const onRelease = (event: GestureResponderEvent) => {
    const start = press.current;
    press.current = null;
    if (!start) return;
    const { locationX, locationY } = event.nativeEvent;
    const moved = { x: event.nativeEvent.pageX - start.x, y: event.nativeEvent.pageY - start.y };
    const point = pagePoint({ x: locationX, y: locationY }, box, viewport);
    const scale = viewport.width / Math.max(1, box.width);
    // A swipe scrolls the page the way a finger drags it; a short press is a tap.
    if (Math.hypot(moved.x, moved.y) < SWIPE_PX) {
      void send({ kind: "tap", ...point });
      keyboard.current?.focus();
    } else {
      void send({
        kind: "scroll",
        ...point,
        dx: Math.max(-5000, Math.min(5000, Math.round(-moved.x * scale))),
        dy: Math.max(-5000, Math.min(5000, Math.round(-moved.y * scale))),
      });
    }
  };

  const navButton = (label: string, glyph: string, onPress: () => void, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={{ paddingHorizontal: 8, paddingVertical: 6, opacity: disabled ? 0.35 : 1 }}
    >
      <Text style={{ color: tokens.foreground, fontSize: 20 }}>{glyph}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.background }} edges={["top", "bottom"]}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 2,
          paddingHorizontal: 6,
          paddingVertical: 6,
          borderBottomWidth: 1,
          borderBottomColor: tokens.border,
        }}
      >
        {navButton(t`Back`, "‹", () => void send({ kind: "back" }), !page?.canGoBack)}
        {navButton(t`Forward`, "›", () => void send({ kind: "forward" }), !page?.canGoForward)}
        {navButton(t`Reload`, "↻", () => void send({ kind: "reload" }))}
        <TextInput
          accessibilityLabel={t`Address`}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          selectTextOnFocus
          value={address ?? page?.url ?? ""}
          onChangeText={setAddress}
          onSubmitEditing={() => {
            const url = address?.trim();
            if (url) void send({ kind: "navigate", url });
            setAddress(null);
          }}
          onBlur={() => setAddress(null)}
          style={{
            flex: 1,
            minWidth: 0,
            height: 36,
            borderRadius: 10,
            paddingHorizontal: 10,
            backgroundColor: tokens.muted,
            color: tokens.foreground,
            fontSize: 14,
          }}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => void handBack()}
          style={{
            marginStart: 6,
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 7,
            backgroundColor: tokens.primary,
          }}
        >
          <Text style={{ color: tokens.primaryForeground, fontSize: 13, fontWeight: "600" }}>
            {t`Hand back`}
          </Text>
        </Pressable>
      </View>
      {error ? (
        <Text
          accessibilityRole="alert"
          style={{ paddingHorizontal: 12, paddingVertical: 8, color: tokens.destructive }}
        >
          {error}
        </Text>
      ) : null}
      <View style={{ flex: 1, alignItems: "center", backgroundColor: tokens.muted }}>
        {page?.image ? (
          <View
            onLayout={(event: LayoutChangeEvent) => {
              const { width, height } = event.nativeEvent.layout;
              setBox({ width, height });
            }}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(event) => {
              press.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
            }}
            onResponderRelease={onRelease}
            onResponderTerminate={() => {
              press.current = null;
            }}
            style={{
              width: "100%",
              maxHeight: "100%",
              aspectRatio: viewport.width / viewport.height,
            }}
          >
            <Image
              source={{ uri: page.image }}
              accessibilityLabel={page.title || t`Page`}
              accessibilityIgnoresInvertColors
              resizeMode="stretch"
              style={{ width: "100%", height: "100%" }}
            />
          </View>
        ) : (
          <ActivityIndicator style={{ marginTop: 48 }} color={tokens.mutedForeground} />
        )}
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 8,
          paddingVertical: 6,
          borderTopWidth: 1,
          borderTopColor: tokens.border,
        }}
      >
        <TextInput
          ref={keyboard}
          accessibilityLabel={t`Type on the page`}
          placeholder={t`Type on the page`}
          placeholderTextColor={tokens.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          blurOnSubmit={false}
          returnKeyType="send"
          value={typing}
          onChangeText={setTyping}
          onKeyPress={(event) => {
            if (event.nativeEvent.key === "Backspace" && typing === "") {
              void send({ kind: "key", key: "Backspace" });
            }
          }}
          onSubmitEditing={() => {
            if (typing) void send({ kind: "text", text: typing });
            setTyping("");
            void send({ kind: "key", key: "Enter" });
          }}
          style={{
            flex: 1,
            height: 36,
            borderRadius: 10,
            paddingHorizontal: 10,
            backgroundColor: tokens.muted,
            color: tokens.foreground,
            fontSize: 14,
          }}
        />
        <Pressable
          accessibilityRole="button"
          disabled={!typing}
          onPress={() => {
            if (typing) void send({ kind: "text", text: typing });
            setTyping("");
          }}
          style={{ paddingHorizontal: 10, paddingVertical: 6, opacity: typing ? 1 : 0.4 }}
        >
          <Text style={{ color: tokens.foreground, fontSize: 14, fontWeight: "600" }}>
            {t`Type`}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
