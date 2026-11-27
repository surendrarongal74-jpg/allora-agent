import type {
  AdapterContext,
  BrowserActRequest,
  BrowserActResult,
  BrowserNavigateRequest,
  BrowserNavigateResult,
  BrowserProvider,
  BrowserSnapshotRequest,
  BrowserSnapshotResult,
  ComputerRef,
} from "@rakazo/adapter-kit";
import type { CdpConnect } from "../../../browser/cdp-page-render.js";
import { renderPageOverCdp } from "../../../browser/cdp-page-render.js";
import { FakeBrowserProvider } from "../../../browser/fake-browser.js";
import { pageBrowserSessionKey } from "../../../browser/page-browser-session.js";
import type { ResolveHostname } from "../../../web/web-ssrf.js";
import { assertSafeWebUrl } from "../../../web/web-ssrf.js";

export const DEFAULT_BROWSER_CDP_URL = "ws://127.0.0.1:9222";

const READ_ONLY =
  "This browser only reads pages. Open a link's address with browser_navigate, or click and type on the computer.";

export interface LightpandaBrowserProviderOptions {
  /** The headless browser's DevTools endpoint, as `lightpanda serve` listens on it. */
  cdpUrl?: string;
  /** Test seams. */
  connect?: CdpConnect;
  resolveHostname?: ResolveHostname;
}

/**
 * Reads pages through a Lightpanda headless browser over CDP. Lightpanda runs each page's scripts,
 * and the page as its DOM then stands is snapshotted by the same in-process session the other page
 * browsers share. It draws nothing and holds no page between calls, so actions on a page, and
 * anything that needs pixels or a page it cannot open, fall back to the computer's screen.
 */
export class LightpandaBrowserProvider implements BrowserProvider {
  private readonly cdpUrl: string;
  private readonly connect?: CdpConnect;
  private readonly resolveHostname?: ResolveHostname;
  /** Holds each bot's current page for snapshots and actions, between navigations. */
  private readonly pages = new FakeBrowserProvider();

  constructor(options: LightpandaBrowserProviderOptions = {}) {
    this.cdpUrl = options.cdpUrl?.trim() || DEFAULT_BROWSER_CDP_URL;
    this.connect = options.connect;
    this.resolveHostname = options.resolveHostname;
  }

  describe() {
    return {
      id: "lightpanda",
      contractVersion: "1",
      adapterVersion: "0.1.0",
      capabilities: { page: true, refs: false, keyless: true },
    };
  }

  async navigate(
    computer: ComputerRef,
    request: BrowserNavigateRequest,
    context: AdapterContext,
  ): Promise<BrowserNavigateResult> {
    const url = request.url.trim();
    const signal = request.signal ?? context.signal;
    try {
      // The browser fetches from its own network, so a private address is refused here first,
      // and again when a redirect lands on one.
      await assertSafeWebUrl(url, this.resolveHostname, signal);
      const page = await renderPageOverCdp(this.cdpUrl, url, signal, this.connect);
      await assertSafeWebUrl(page.url, this.resolveHostname, signal);
      return this.pages.sessions
        .get(pageBrowserSessionKey(computer, context))
        .load(page.url, page.html);
    } catch (error) {
      signal.throwIfAborted();
      return {
        url,
        title: "",
        fallback: "computer_act",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  snapshot(
    computer: ComputerRef,
    request: BrowserSnapshotRequest,
    context: AdapterContext,
  ): Promise<BrowserSnapshotResult> {
    return this.pages.snapshot(computer, request, context);
  }

  /** Clicks and typing would change only the copy read here, never the page the site serves. */
  async act(
    computer: ComputerRef,
    _request: BrowserActRequest,
    context: AdapterContext,
  ): Promise<BrowserActResult> {
    const page = this.pages.sessions.get(pageBrowserSessionKey(computer, context));
    return {
      ok: false,
      completed: 0,
      uncertain: false,
      url: page.url,
      title: page.title,
      fallback: "computer_act",
      error: READ_ONLY,
    };
  }
}
