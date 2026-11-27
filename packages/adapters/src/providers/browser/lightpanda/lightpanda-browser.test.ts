import type { AdapterContext, ComputerRef } from "@rakazo/adapter-kit";
import { describe, expect, it, vi } from "vitest";
import {
  createBrowserProvider,
  resolveBrowserProviderKind,
} from "../../../browser/browser-provider-factory.js";
import type { CdpConnect, CdpConnection } from "../../../browser/cdp-page-render.js";
import { LightpandaBrowserProvider } from "./lightpanda-browser.js";

const context: AdapterContext = {
  operationId: "1",
  traceId: "1",
  spaceId: "w",
  userId: "u",
  botId: "bot-a",
  signal: new AbortController().signal,
};
const computer: ComputerRef = { id: "c-1", botId: "bot-a", kind: "docker", providerRef: "c-1" };
const publicHost = async () => [{ address: "93.184.216.34", family: 4 }];

/** A DevTools endpoint that serves one page, as its scripts left it. */
function fakeBrowser(page: { url: string; html: string }) {
  const calls: string[] = [];
  const connection: CdpConnection = {
    async send(method) {
      calls.push(method);
      switch (method) {
        case "Target.createBrowserContext":
          return { browserContextId: "ctx-1" };
        case "Target.createTarget":
          return { targetId: "t-1" };
        case "Target.attachToTarget":
          return { sessionId: "s-1" };
        case "Runtime.evaluate":
          return { result: { value: JSON.stringify(page) } };
        default:
          return {};
      }
    },
    next: async () => undefined,
    close: () => calls.push("close"),
  };
  const connect = vi.fn<CdpConnect>(async () => connection);
  return { connect, calls };
}

describe("lightpanda browser provider", () => {
  it("is chosen by BROWSER_PROVIDER=lightpanda", () => {
    expect(resolveBrowserProviderKind({ BROWSER_PROVIDER: "lightpanda" })).toBe("lightpanda");
    expect(createBrowserProvider("lightpanda").describe().id).toBe("lightpanda");
  });

  it("reads the page its scripts rendered", async () => {
    const browser = fakeBrowser({
      url: "https://shop.example/after-redirect",
      html: `<!doctype html><html><head><title>Shop</title></head><body>
        <input aria-label="Search" /></body></html>`,
    });
    const provider = new LightpandaBrowserProvider({
      cdpUrl: "ws://browser.internal:9222",
      connect: browser.connect,
      resolveHostname: publicHost,
    });

    const opened = await provider.navigate(computer, { url: "https://shop.example/" }, context);
    expect(opened).toEqual({ url: "https://shop.example/after-redirect", title: "Shop" });
    expect(browser.connect).toHaveBeenCalledWith("ws://browser.internal:9222", context.signal);
    expect(browser.calls).toContain("Target.disposeBrowserContext");
    expect(browser.calls.at(-1)).toBe("close");

    const snapshot = await provider.snapshot(computer, {}, context);
    expect(snapshot.elements).toEqual([expect.objectContaining({ name: "Search" })]);
  });

  it("sends clicks and typing to the computer, since it holds only a copy of the page", async () => {
    const provider = new LightpandaBrowserProvider();

    const result = await provider.act(
      computer,
      { actions: [{ kind: "click", ref: "e1" }] },
      context,
    );

    expect(result).toMatchObject({
      ok: false,
      completed: 0,
      uncertain: false,
      fallback: "computer_act",
    });
  });

  it("refuses a private address before the browser fetches it", async () => {
    const browser = fakeBrowser({ url: "http://10.0.0.5/", html: "" });
    const provider = new LightpandaBrowserProvider({ connect: browser.connect });

    const result = await provider.navigate(computer, { url: "http://10.0.0.5/admin" }, context);

    expect(result).toMatchObject({ fallback: "computer_act" });
    expect(browser.connect).not.toHaveBeenCalled();
  });

  it("falls back to the computer's screen when the browser cannot be reached", async () => {
    const provider = new LightpandaBrowserProvider({
      connect: async () => {
        throw new Error("The browser endpoint could not be reached.");
      },
      resolveHostname: publicHost,
    });

    const result = await provider.navigate(computer, { url: "https://example.com/" }, context);

    expect(result).toEqual({
      url: "https://example.com/",
      title: "",
      fallback: "computer_act",
      error: "The browser endpoint could not be reached.",
    });
  });
});
