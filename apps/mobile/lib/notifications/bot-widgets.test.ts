import { deferred } from "@rakazo/core/test-async";
import { beforeEach, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  hasBotWidgets: vi.fn(() => true),
  setBotWidgets: vi.fn(async (_spaceId: string, _active: string, _recent: string) => undefined),
}));
const space = vi.hoisted(() => ({ id: "space-1" as string | null }));
const activity = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock("expo-modules-core", () => ({ requireOptionalNativeModule: () => native }));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("../api/api", () => ({ selectedSpaceId: () => space.id }));
vi.mock("../api/roster-signals", () => ({ useSpaceChanges: vi.fn() }));
vi.mock("../inbox/activity", () => ({ fetchSpaceActivity: activity.fetch }));

const { updateBotWidgets } = await import("./bot-widgets");

const run = { runId: "r1", botId: "b1", botName: "Ada", status: "running" };

beforeEach(() => {
  vi.clearAllMocks();
  native.hasBotWidgets.mockReturnValue(true);
  space.id = "space-1";
  activity.fetch.mockResolvedValue({ active: [run], recent: [] });
});

it("hands the placed widgets the Space's runs", async () => {
  await updateBotWidgets();

  expect(native.setBotWidgets).toHaveBeenCalledWith("space-1", JSON.stringify([run]), "[]");
});

it("reads nothing while no widget is on the home screen", async () => {
  native.hasBotWidgets.mockReturnValue(false);

  await updateBotWidgets();

  expect(activity.fetch).not.toHaveBeenCalled();
  expect(native.setBotWidgets).not.toHaveBeenCalled();
});

it("drops a read the user switched Spaces during", async () => {
  const read = deferred<{ active: unknown[]; recent: unknown[] }>();
  activity.fetch.mockReturnValue(read.promise);

  const update = updateBotWidgets();
  space.id = "space-2";
  read.resolve({ active: [run], recent: [] });
  await update;

  expect(native.setBotWidgets).not.toHaveBeenCalled();
});
