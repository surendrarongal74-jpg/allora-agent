// The home-screen bot widgets: their providers, layouts and drawing live in the notifications
// module, beside the poll that keeps them current. This declares them in the app's manifest,
// the one the launcher reads to list an app's widgets.
const { withAndroidManifest } = require("expo/config-plugins");

const PACKAGE = "com.rakazo.notifications";
const WIDGETS = [
  { name: "RakazoBotsWidget", label: "rakazo_widget_bots_name", info: "rakazo_bots_widget_info" },
  { name: "RakazoBotWidget", label: "rakazo_widget_bot_name", info: "rakazo_bot_widget_info" },
];

function addBotWidgets(manifest) {
  const app = manifest.application?.[0];
  if (!app) throw new Error("with-android-widgets: the manifest has no <application>.");
  const receivers = (app.receiver ?? []).filter(
    (receiver) =>
      !WIDGETS.some(({ name }) => receiver.$?.["android:name"] === `${PACKAGE}.${name}`),
  );
  app.receiver = [
    ...receivers,
    ...WIDGETS.map(({ name, label, info }) => ({
      $: {
        "android:name": `${PACKAGE}.${name}`,
        "android:exported": "false",
        "android:label": `@string/${label}`,
      },
      "intent-filter": [
        { action: [{ $: { "android:name": "android.appwidget.action.APPWIDGET_UPDATE" } }] },
      ],
      "meta-data": [
        { $: { "android:name": "android.appwidget.provider", "android:resource": `@xml/${info}` } },
      ],
    })),
  ];
  return manifest;
}

function withAndroidWidgets(config) {
  return withAndroidManifest(config, (cfg) => {
    addBotWidgets(cfg.modResults.manifest);
    return cfg;
  });
}

module.exports = withAndroidWidgets;
module.exports.addBotWidgets = addBotWidgets;
