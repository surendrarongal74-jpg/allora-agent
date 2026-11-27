import { Trans } from "@lingui/react/macro";
import { Button } from "@rakazo/ui-web";
import { useQuery } from "@tanstack/react-query";
import { Globe } from "lucide-react";
import { useState } from "react";
import { useSpaceQueries } from "../../lib/query/query";
import { BrowserTakeover } from "./BrowserTakeover";

/** How often the card's still of the page is taken again while someone watches it. */
export const PAGE_VIEW_REFRESH_MS = 1500;

export function pageHost(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

/** The page the bot is using, live, with what it is doing there and a way to take it over. */
export function BrowserLiveCard({ botId, step }: { botId: string; step?: string }) {
  const queries = useSpaceQueries();
  const [takingOver, setTakingOver] = useState(false);
  const view = useQuery({
    ...queries.computer.pageView.queryOptions({ input: { botId } }),
    // A live view, like the screen: read again only while the card is on a visible page.
    refetchInterval: takingOver ? false : PAGE_VIEW_REFRESH_MS,
    retry: false,
    gcTime: 0,
  });
  const page = view.data;
  if (!page?.image && !view.isPending) return null;
  return (
    <div
      data-testid="browser-live-card"
      className="w-full max-w-[520px] rounded-[18px] border border-border bg-muted px-4 py-3"
    >
      <div className="flex min-w-0 items-center gap-2">
        <Globe aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 truncate text-body-sm text-muted-foreground">
          {page?.url ? pageHost(page.url) : <Trans>Browser</Trans>}
        </span>
      </div>
      {page?.image ? (
        <img
          src={page.image}
          alt=""
          draggable={false}
          className="mt-2 block max-h-[360px] w-full rounded-lg border border-border bg-background object-contain object-top"
        />
      ) : (
        <div className="mt-2 aspect-[16/10] w-full animate-pulse rounded-lg bg-foreground/5" />
      )}
      <div className="mt-2 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-body-sm text-foreground">{step}</span>
        <Button type="button" size="sm" variant="outline" onClick={() => setTakingOver(true)}>
          <Trans>Take over</Trans>
        </Button>
      </div>
      {takingOver ? <BrowserTakeover botId={botId} onClose={() => setTakingOver(false)} /> : null}
    </div>
  );
}
