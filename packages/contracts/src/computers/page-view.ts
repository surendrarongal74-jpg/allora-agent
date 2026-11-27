import * as z from "zod";

/** The page the bot browses, as a still and where it is. Coordinates elsewhere are CSS pixels of `viewport`. */
export const PageViewSchema = z.object({
  image: z.string().nullable(),
  url: z.string(),
  title: z.string(),
  viewport: z.object({ width: z.number(), height: z.number() }).nullable(),
  canGoBack: z.boolean(),
  canGoForward: z.boolean(),
});
export type PageView = z.infer<typeof PageViewSchema>;

const point = { x: z.number().min(0).max(10_000), y: z.number().min(0).max(10_000) };

/** Keys a phone keyboard sends that are not text. */
export const PAGE_KEYS = [
  "Enter",
  "Backspace",
  "Tab",
  "Escape",
  "ArrowLeft",
  "ArrowUp",
  "ArrowRight",
  "ArrowDown",
  "Delete",
] as const;

export const PageInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("tap"), ...point }),
  z.object({
    kind: z.literal("scroll"),
    ...point,
    dx: z.number().min(-5000).max(5000),
    dy: z.number().min(-5000).max(5000),
  }),
  z.object({ kind: z.literal("text"), text: z.string().min(1).max(2000) }),
  z.object({ kind: z.literal("key"), key: z.enum(PAGE_KEYS) }),
  z.object({ kind: z.literal("navigate"), url: z.string().min(1).max(2048) }),
  z.object({ kind: z.literal("back") }),
  z.object({ kind: z.literal("forward") }),
  z.object({ kind: z.literal("reload") }),
  /** A phone-sized screen while a person drives the page, and the bot's own size again after. */
  z.object({ kind: z.literal("phone") }),
  z.object({ kind: z.literal("desktop") }),
]);
export type PageInput = z.infer<typeof PageInputSchema>;
