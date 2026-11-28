import { secureHttpOrigin } from "@rakazo/contracts/network-host";
import { build } from "esbuild";

// The server a first launch opens instead of ALLORA Cloud (see src/main/setup/setup-config.ts).
const defaultServerUrl = process.env.RAKAZO_DEFAULT_SERVER_URL?.trim() ?? "";
if (defaultServerUrl !== "" && secureHttpOrigin(defaultServerUrl) === null) {
  throw new Error("RAKAZO_DEFAULT_SERVER_URL must use https:// (http:// only for localhost).");
}

await build({
  entryPoints: ["src/main/main.ts"],
  outfile: "dist/main.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  sourcemap: true,
  banner: {
    js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
  external: ["electron", "electron-updater", "koffi", "@sentry/electron"],
  // Only the release workflow's builds report errors; local and agent builds never do.
  define: {
    "process.env.RAKAZO_DESKTOP_RELEASE": JSON.stringify(process.env.RAKAZO_DESKTOP_RELEASE ?? ""),
    // Self-hosted builds associated with their own passkey domain (see src/main/auth/passkeys.ts).
    "process.env.RAKAZO_PASSKEY_RP_ID": JSON.stringify(process.env.RAKAZO_PASSKEY_RP_ID ?? ""),
    "process.env.RAKAZO_DEFAULT_SERVER_URL": JSON.stringify(defaultServerUrl),
  },
});

// The entry Electron starts: turns on the compile cache, then loads the bundle above.
await build({
  entryPoints: ["src/main/launch.ts"],
  outfile: "dist/launch.js",
  platform: "node",
  format: "esm",
  target: "node24",
});
