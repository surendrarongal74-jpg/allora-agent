import { bestEffort } from "@rakazo/logging/best-effort";
import { requireOptionalNativeModule } from "expo-modules-core";
import { useEffect } from "react";
import { Platform } from "react-native";
import { selectedSpaceId } from "../api/api";
import { useSpaceChanges } from "../api/roster-signals";
import { fetchSpaceActivity } from "../inbox/activity";

type NativeBotWidgets = {
  hasBotWidgets(): boolean;
  setBotWidgets(spaceId: string, active: string, recent: string): Promise<void>;
};

// Android only, and missing from app builds from before the widgets.
const native =
  Platform.OS === "android"
    ? requireOptionalNativeModule<Partial<NativeBotWidgets>>("RakazoNotifications")
    : null;
const widgets = native?.hasBotWidgets && native.setBotWidgets ? (native as NativeBotWidgets) : null;

/** Hands the home-screen widgets the Space's running and recent work, when any widget is placed. */
export async function updateBotWidgets(): Promise<void> {
  const spaceId = selectedSpaceId();
  if (!widgets || !spaceId || !widgets.hasBotWidgets()) return;
  const { active, recent } = await fetchSpaceActivity();
  // A Space switched during the read: its bots are not the ones the widgets should show.
  if (spaceId !== selectedSpaceId()) return;
  await widgets.setBotWidgets(spaceId, JSON.stringify(active), JSON.stringify(recent));
}

const refresh = () => bestEffort("update the bot widgets", updateBotWidgets());

/**
 * Keeps the widgets current while the app runs: on launch, on each return to the app (when a
 * widget may also have just been added), and whenever the Space's runs change. While the app is
 * closed, the notification poll keeps them current for as long as bots are at work.
 */
export function useBotWidgets(enabled: boolean): void {
  const placed = enabled && (widgets?.hasBotWidgets() ?? false);
  useEffect(() => {
    if (placed) void refresh();
  }, [placed]);
  useSpaceChanges("runs", refresh, placed);
}
