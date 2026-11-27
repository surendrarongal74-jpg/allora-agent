import type { PageInput, PageView } from "@rakazo/contracts";
import { bestEffort } from "@rakazo/logging/best-effort";
import { rpc } from "../api/api";

/**
 * The person's side of the bot's page: take control of it, drive it, check in, and hand it back.
 * Reuses the computer's control lease, the same as the web takeover.
 */
export async function takeOverPage(botId: string): Promise<string> {
  const lease = await rpc("computer/takeover", { botId });
  return lease.leaseId;
}

export function sendPageInput(botId: string, input: PageInput): Promise<PageView> {
  return rpc("computer/pageInput", { botId, input });
}

export function pageControlHeartbeat(botId: string): Promise<unknown> {
  return bestEffort("page.takeover_heartbeat", rpc("computer/heartbeat", { botId }));
}

/** The bot's own screen size again, then control back to the bot. */
export async function handBackPage(botId: string, leaseId: string): Promise<void> {
  await bestEffort("page.takeover_desktop", sendPageInput(botId, { kind: "desktop" }));
  await bestEffort("page.takeover_release", rpc("computer/release", { botId, leaseId }));
}
