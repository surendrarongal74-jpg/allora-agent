import type { BrowserProvider, SandboxProvider } from "@rakazo/adapter-kit";
import { ComputerBrowserProvider } from "../computers/screens/computer-browser.js";
import { LightpandaBrowserProvider } from "../providers/browser/lightpanda/lightpanda-browser.js";
import { EmulatorBrowserProvider } from "./browser-emulator.js";
import type { FakeBrowserProviderOptions } from "./fake-browser.js";
import { FakeBrowserProvider } from "./fake-browser.js";

export type CreateBrowserProviderOptions = FakeBrowserProviderOptions & {
  sandbox?: SandboxProvider;
  /** DevTools endpoint of a headless browser; defaults to BROWSER_CDP_URL. */
  cdpUrl?: string;
};

/**
 * Production default is always `computer` (live CDP on the bot computer). Fake and emulator
 * are selected only by BROWSER_PROVIDER=fake or emulator, for offline conformance;
 * `lightpanda` reads pages through a headless browser at BROWSER_CDP_URL instead.
 */
export function resolveBrowserProviderKind(source: NodeJS.ProcessEnv = process.env): string {
  const raw = source.BROWSER_PROVIDER?.trim().toLowerCase();
  if (!raw || raw === "computer" || raw === "sandbox") return "computer";
  if (raw === "fake") return "fake";
  if (raw === "emulator") return "emulator";
  return raw;
}

export function createBrowserProvider(
  kind?: string,
  options?: CreateBrowserProviderOptions,
): BrowserProvider {
  const resolved = (kind ?? resolveBrowserProviderKind()).trim() || resolveBrowserProviderKind();
  switch (resolved) {
    case "computer":
    case "sandbox":
    case "":
      return new ComputerBrowserProvider(options);
    case "fake":
      return new FakeBrowserProvider(options);
    case "emulator":
      return new EmulatorBrowserProvider(options);
    case "lightpanda":
      return new LightpandaBrowserProvider({
        cdpUrl: options?.cdpUrl ?? process.env.BROWSER_CDP_URL,
      });
    default:
      throw new Error(`Unknown browser provider "${resolved}"`);
  }
}
