import type { PageBrowserCommand, PageBrowserResult } from "@rakazo/adapter-kit";
import { isSandboxGoneError, wakeableComputerRef } from "@rakazo/adapters";
import type { Actor, PageInput, PageView } from "@rakazo/contracts";
import { ClientError } from "@rakazo/core";
import { bestEffort, getLogger } from "@rakazo/logging";
import type { RouterDeps } from "../router.js";
import type { RouterContext } from "../routes/context.js";
import {
  clearGoneSandbox,
  computerScreenContext,
  expireStaleComputerControl,
  holdsComputerControl,
} from "./computer-control.js";

type ViewDeps = RouterDeps;
type Bot = Awaited<ReturnType<RouterContext["repos"]["getBot"]>>;

const EMPTY: PageView = {
  image: null,
  url: "",
  title: "",
  viewport: null,
  canGoBack: false,
  canGoForward: false,
};

function toView(result: PageBrowserResult | null): PageView {
  if (!result?.ok) return EMPTY;
  return {
    image: typeof result.image === "string" ? result.image : null,
    url: typeof result.url === "string" ? result.url : "",
    title: typeof result.title === "string" ? result.title : "",
    viewport: result.viewport ?? null,
    canGoBack: result.canGoBack === true,
    canGoForward: result.canGoForward === true,
  };
}

async function runPageCommand(
  deps: ViewDeps,
  actor: Actor,
  bot: Bot,
  request: PageBrowserCommand,
): Promise<PageBrowserResult | null> {
  const computer = bot.computer;
  const pageBrowser = deps.sandbox.pageBrowser?.bind(deps.sandbox);
  if (!computer?.providerRef || computer.state !== "running" || !pageBrowser) return null;
  return pageBrowser(
    await wakeableComputerRef(deps.prisma, computer),
    request,
    await computerScreenContext(deps.prisma, actor, computer.id, bot.id, "page-view"),
  ).catch(async (error: unknown) => {
    if (isSandboxGoneError(error)) {
      await clearGoneSandbox(deps, computer, error);
      return null;
    }
    getLogger().warn("computer.page_view_failed", { error });
    return null;
  });
}

/** What the bot's page tools show now; empty when no page is open. Watching never takes control. */
export async function readPageView(
  deps: ViewDeps,
  actor: Actor,
  bot: Bot,
  large: boolean,
): Promise<PageView> {
  return toView(await runPageCommand(deps, actor, bot, { command: "view", large }));
}

/** One input from the person who holds this bot's computer, then the page as it is after it. */
export async function drivePage(
  deps: ViewDeps,
  actor: Actor,
  bot: Bot,
  input: PageInput,
): Promise<PageView> {
  const computer = bot.computer;
  if (!computer || !holdsComputerControl(computer, bot.id, actor)) {
    await expireStaleComputerControl(deps, computer);
    throw new ClientError("FORBIDDEN", "Take over first");
  }
  const result = await runPageCommand(deps, actor, bot, { command: "drive", input });
  if (result && !result.ok && typeof result.error === "string") {
    throw new ClientError("BAD_REQUEST", result.error);
  }
  return toView(result);
}

/** The bot's own screen size again once a person hands the page back, even from a page that closed. */
export function restorePageViewport(deps: ViewDeps, actor: Actor, bot: Bot): void {
  void bestEffort(
    "computer.page_viewport_restore",
    runPageCommand(deps, actor, bot, { command: "drive", input: { kind: "desktop" } }),
  );
}
