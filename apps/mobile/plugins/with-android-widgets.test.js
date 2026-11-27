import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { addBotWidgets } from "./with-android-widgets.js";

const resources = join(
  import.meta.dirname,
  "..",
  "modules/rakazo-notifications/android/src/main/res/xml",
);

it("declares both bot widgets with the provider info the module ships", () => {
  const manifest = addBotWidgets({ application: [{ $: {} }] });
  const receivers = manifest.application[0].receiver;
  expect(receivers.map((receiver) => receiver.$["android:name"])).toEqual([
    "com.rakazo.notifications.RakazoBotsWidget",
    "com.rakazo.notifications.RakazoBotWidget",
  ]);
  for (const receiver of receivers) {
    const info = receiver["meta-data"][0].$["android:resource"].replace("@xml/", "");
    expect(existsSync(join(resources, `${info}.xml`)), info).toBe(true);
  }
});

it("replaces its own receivers on a second prebuild and keeps the others", () => {
  const other = { $: { "android:name": ".OtherReceiver" } };
  const manifest = addBotWidgets(addBotWidgets({ application: [{ $: {}, receiver: [other] }] }));
  expect(manifest.application[0].receiver).toHaveLength(3);
  expect(manifest.application[0].receiver[0]).toBe(other);
});

it("fails prebuild when the manifest has no application", () => {
  expect(() => addBotWidgets({})).toThrow(/no <application>/);
});
