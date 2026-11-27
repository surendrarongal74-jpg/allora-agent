import { deadlineSignal, withAbort } from "@rakazo/core";
import { bestEffort } from "@rakazo/logging";

/** One DevTools protocol connection: commands answered by id, events seen as they arrive. */
export interface CdpConnection {
  send(method: string, params?: Record<string, unknown>, sessionId?: string): Promise<unknown>;
  /** Resolves on the next event of this method in this session. */
  next(method: string, sessionId: string, signal: AbortSignal): Promise<void>;
  close(): void;
}

export type CdpConnect = (endpoint: string, signal: AbortSignal) => Promise<CdpConnection>;

export interface RenderedPage {
  url: string;
  html: string;
}

const LOAD_TIMEOUT_MS = 15_000;
/** Kept in line with the in-process page browser's own fetch limit. */
const MAX_HTML_CHARS = 5 * 1024 * 1024;
const READ_PAGE =
  "JSON.stringify({ url: location.href, html: document.documentElement ? document.documentElement.outerHTML : '' })";

/**
 * Opens `url` in a fresh browser context on a DevTools endpoint, runs its scripts until it loads,
 * and returns the page as its DOM then stands. The context is disposed afterwards, so nothing
 * (cookies, storage) carries over between pages.
 */
export async function renderPageOverCdp(
  endpoint: string,
  url: string,
  signal: AbortSignal,
  connect: CdpConnect = openCdpConnection,
): Promise<RenderedPage> {
  const cdp = await connect(endpoint, signal);
  let browserContextId: string | undefined;
  try {
    const context = (await cdp.send("Target.createBrowserContext")) as {
      browserContextId?: string;
    };
    browserContextId = context.browserContextId;
    const { targetId } = (await cdp.send("Target.createTarget", {
      url: "about:blank",
      ...(browserContextId ? { browserContextId } : {}),
    })) as { targetId: string };
    const { sessionId } = (await cdp.send("Target.attachToTarget", {
      targetId,
      flatten: true,
    })) as { sessionId: string };
    await cdp.send("Page.enable", {}, sessionId);
    // Listening before navigating, so a fast load is not missed. A page that never finishes
    // loading is still read as it stands once the wait runs out.
    const loaded = cdp
      .next("Page.loadEventFired", sessionId, deadlineSignal(LOAD_TIMEOUT_MS, signal))
      .then(
        () => true,
        () => false,
      );
    const navigation = (await cdp.send("Page.navigate", { url }, sessionId)) as {
      errorText?: string;
    };
    if (navigation.errorText) throw new Error(`The page did not load: ${navigation.errorText}`);
    await loaded;
    signal.throwIfAborted();
    const read = (await cdp.send(
      "Runtime.evaluate",
      { expression: READ_PAGE, returnByValue: true },
      sessionId,
    )) as { result?: { value?: unknown }; exceptionDetails?: unknown };
    if (read.exceptionDetails || typeof read.result?.value !== "string") {
      throw new Error("The page could not be read.");
    }
    const page = JSON.parse(read.result.value) as RenderedPage;
    if (page.html.length > MAX_HTML_CHARS) throw new Error("The page is too large to read.");
    return page;
  } finally {
    if (browserContextId) {
      await bestEffort(
        "dispose the page's browser context",
        cdp.send("Target.disposeBrowserContext", { browserContextId }),
      );
    }
    cdp.close();
  }
}

/** A DevTools connection over the runtime's own WebSocket. */
export async function openCdpConnection(
  endpoint: string,
  signal: AbortSignal,
): Promise<CdpConnection> {
  const socket = new WebSocket(endpoint);
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (e: Error) => void }
  >();
  const waiters = new Set<{ method: string; sessionId: string; resolve: () => void }>();
  let nextId = 1;
  let closed: Error | undefined;

  const fail = (error: Error) => {
    closed ??= error;
    for (const call of pending.values()) call.reject(closed);
    pending.clear();
  };
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data)) as {
      id?: number;
      method?: string;
      sessionId?: string;
      result?: unknown;
      error?: { message?: string };
    };
    if (message.id !== undefined) {
      const call = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) call?.reject(new Error(message.error.message ?? "DevTools error"));
      else call?.resolve(message.result ?? {});
      return;
    }
    for (const waiter of waiters) {
      if (waiter.method === message.method && waiter.sessionId === message.sessionId) {
        waiters.delete(waiter);
        waiter.resolve();
      }
    }
  });
  socket.addEventListener("close", () => fail(new Error("The browser closed the connection.")));

  await withAbort(
    new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener(
        "error",
        () => reject(new Error("The browser endpoint could not be reached.")),
        { once: true },
      );
    }),
    signal,
  ).catch((error: unknown) => {
    socket.close();
    throw error;
  });

  return {
    send(method, params = {}, sessionId) {
      if (closed) return Promise.reject(closed);
      const id = nextId++;
      const answer = new Promise<unknown>((resolve, reject) => {
        pending.set(id, { resolve, reject });
      });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      return withAbort(answer, signal);
    },
    next(method, sessionId, waitSignal) {
      return withAbort(
        new Promise<void>((resolve) => {
          waiters.add({ method, sessionId, resolve });
        }),
        waitSignal,
      );
    },
    close() {
      waiters.clear();
      fail(new Error("The connection is closed."));
      socket.close();
    },
  };
}
