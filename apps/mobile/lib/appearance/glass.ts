import type { ColorTokens, ResolvedAppearance } from "@rakazo/ui-tokens";
import { Platform } from "react-native";

/**
 * The mobile glass theme: frosted, translucent surfaces over a warm gradient.
 * Text keeps WCAG AA contrast: dark ink on light glass, white on the deep brand orange.
 */
const lightGlass = {
  background: "#FFF3E6",
  card: "rgba(255, 255, 255, 0.55)",
  muted: "rgba(255, 255, 255, 0.62)",
  glassFill: "rgba(255, 250, 244, 0.6)",
  glassStroke: "rgba(255, 255, 255, 0.85)",
  border: "rgba(120, 60, 20, 0.12)",
  chatUser: "rgba(184, 58, 10, 0.95)",
  chatUserForeground: "#FFFFFF",
} as const satisfies Partial<ColorTokens>;

const darkGlass = {
  background: "#17110D",
  card: "rgba(255, 240, 225, 0.08)",
  muted: "rgba(255, 240, 225, 0.1)",
  glassFill: "rgba(44, 32, 25, 0.62)",
  glassStroke: "rgba(255, 255, 255, 0.16)",
  border: "rgba(255, 255, 255, 0.09)",
  chatUser: "rgba(184, 58, 10, 0.94)",
  chatUserForeground: "#FFFFFF",
} as const satisfies Partial<ColorTokens>;

export function withGlass(tokens: ColorTokens, appearance: ResolvedAppearance): ColorTokens {
  return { ...tokens, ...(appearance === "dark" ? darkGlass : lightGlass) };
}

/** The brand orange (the mascot's), deep enough for white text at 4.5:1 or better. */
export const glassBrand = {
  fill: "#B83A0A",
  foreground: "#FFFFFF",
  /** The pulsing live dot and other small accents that carry no text. */
  accent: "#FF7A2F",
} as const;

/** The warm backdrop: peach to cream by day, deep ember to near-black by night. */
export function glassGradient(appearance: ResolvedAppearance) {
  return appearance === "dark"
    ? { stops: ["#3A2214", "#22160F", "#120D0A"], glow: "#FF7A2F", glowOpacity: 0.12 }
    : { stops: ["#FFD3AE", "#FFE6D0", "#FFF8EF"], glow: "#FFB27A", glowOpacity: 0.45 };
}

/** Rim colors: bright on the top-left edge where light catches the glass, faint elsewhere. */
export function glassRim(appearance: ResolvedAppearance) {
  return appearance === "dark"
    ? { bright: "rgba(255, 255, 255, 0.34)", faint: "rgba(255, 255, 255, 0.06)" }
    : { bright: "rgba(255, 255, 255, 0.95)", faint: "rgba(255, 255, 255, 0.35)" };
}

/**
 * A frosted surface for bubbles and cards: translucent fill, a 1px edge that is brighter on top
 * and left (a cheap specular highlight), and a soft iOS shadow. Android skips elevation, which
 * would darken through a translucent fill.
 */
export function glassSurfaceStyle(tokens: ColorTokens, appearance: ResolvedAppearance) {
  const rim = glassRim(appearance);
  return {
    backgroundColor: tokens.muted,
    borderWidth: 1,
    borderColor: rim.faint,
    borderTopColor: rim.bright,
    borderLeftColor: rim.bright,
    ...glassShadow(appearance),
  } as const;
}

export function glassShadow(appearance: ResolvedAppearance) {
  return Platform.OS === "ios"
    ? ({
        shadowColor: appearance === "dark" ? "#000000" : "#8A3A0A",
        shadowOpacity: appearance === "dark" ? 0.35 : 0.12,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
      } as const)
    : ({} as const);
}

/** Bubble corners: rounded like a texting thread. */
export const BUBBLE_RADIUS = 22;

/** A chat bubble: frosted glass for replies, glossy translucent orange for your own messages. */
export function chatBubbleStyle(
  outgoing: boolean,
  tokens: ColorTokens,
  appearance: ResolvedAppearance,
) {
  if (!outgoing) return glassSurfaceStyle(tokens, appearance);
  return {
    backgroundColor: tokens.chatUser,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderTopColor: "rgba(255, 255, 255, 0.32)",
    borderLeftColor: "rgba(255, 255, 255, 0.18)",
    ...glassShadow(appearance),
  } as const;
}

/** The white light glass catches: specular rims, inner glow and the press sweep. */
export const glassLight = "#FFFFFF";

/** Which appearance a palette is for, read from its ink: white text means dark. */
export function tokensAppearance(tokens: Pick<ColorTokens, "foreground">): ResolvedAppearance {
  return tokens.foreground.toUpperCase().startsWith("#FFF") ? "dark" : "light";
}
