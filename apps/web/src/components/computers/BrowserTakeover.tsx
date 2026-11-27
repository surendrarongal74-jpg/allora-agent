import { useLingui } from "@lingui/react/macro";
import { useNow } from "@rakazo/chat-ui/hooks";
import type { PageInput, PageView } from "@rakazo/contracts";
import { PAGE_KEYS } from "@rakazo/contracts";
import { COMPUTER_CONTROL_HEARTBEAT_MS } from "@rakazo/core";
import { bestEffort } from "@rakazo/logging/best-effort";
import { Button, Input, Spinner } from "@rakazo/ui-web";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, RotateCw } from "lucide-react";
import type { KeyboardEvent, PointerEvent, WheelEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useSpaceQueries } from "../../lib/query/query";
import { rpc } from "../../lib/query/rpc";
import { errorText } from "../../lib/query/user-error";

const TAKEOVER_REFRESH_MS = 1000;
const SPECIAL_KEYS = new Set<string>(PAGE_KEYS);
const SWIPE_PX = 10;

/** Where a point on the shown still falls on the page, in its CSS pixels. */
export function pagePoint(
  client: { x: number; y: number },
  box: { left: number; top: number; width: number; height: number },
  viewport: { width: number; height: number },
) {
  return {
    x: Math.round(((client.x - box.left) / Math.max(1, box.width)) * viewport.width),
    y: Math.round(((client.y - box.top) / Math.max(1, box.height)) * viewport.height),
  };
}

/**
 * The bot's page full screen, as on a phone: the person taps, swipes and types into the same tab
 * the bot uses, then hands it back. Taking over and handing back reuse the computer's control.
 */
export function BrowserTakeover({ botId, onClose }: { botId: string; onClose: () => void }) {
  const { t } = useLingui();
  const queries = useSpaceQueries();
  const [leaseId, setLeaseId] = useState<string | null>(null);
  const [latest, setLatest] = useState<PageView | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const keyboard = useRef<HTMLTextAreaElement>(null);
  const press = useRef<{ x: number; y: number } | null>(null);
  // Inputs go one at a time, in order, like keys on a keyboard.
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const send = (input: PageInput) => {
    queue.current = queue.current.then(async () => {
      try {
        setLatest(await rpc.computer.pageInput({ botId, input }));
        setError(null);
      } catch (failure) {
        setError(errorText(failure, t`That did not reach the page`));
      }
    });
    return queue.current;
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const lease = await rpc.computer.takeover({ botId });
        if (cancelled) {
          await rpc.computer.release({ botId, leaseId: lease.leaseId });
          return;
        }
        setLeaseId(lease.leaseId);
        setLatest(await rpc.computer.pageInput({ botId, input: { kind: "phone" } }));
        keyboard.current?.focus();
      } catch (failure) {
        if (!cancelled) setError(errorText(failure, t`Could not take over`));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [botId, t]);

  // Control lapses unless the page checks in while it is open.
  const tick = useNow(leaseId ? COMPUTER_CONTROL_HEARTBEAT_MS : null);
  useEffect(() => {
    if (leaseId && tick) void bestEffort("page.takeover_heartbeat", rpc.computer.heartbeat({ botId }));
  }, [botId, leaseId, tick]);

  const view = useQuery({
    ...queries.computer.pageView.queryOptions({ input: { botId, large: true } }),
    enabled: Boolean(leaseId),
    refetchInterval: TAKEOVER_REFRESH_MS,
    retry: false,
    gcTime: 0,
  });
  const page = (view.dataUpdatedAt > 0 ? view.data : undefined) ?? latest;

  const handBack = async () => {
    await queue.current;
    if (leaseId) {
      await bestEffort("page.takeover_desktop", rpc.computer.pageInput({ botId, input: { kind: "desktop" } }));
      await bestEffort("page.takeover_release", rpc.computer.release({ botId, leaseId }));
    }
    onClose();
  };

  const at = (event: PointerEvent<HTMLImageElement> | WheelEvent<HTMLImageElement>) =>
    pagePoint(
      { x: event.clientX, y: event.clientY },
      event.currentTarget.getBoundingClientRect(),
      page?.viewport ?? { width: 390, height: 844 },
    );

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing || !SPECIAL_KEYS.has(event.key)) return;
    event.preventDefault();
    void send({ kind: "key", key: event.key as (typeof PAGE_KEYS)[number] });
  };

  return (
    <div
      role="dialog"
      aria-modal
      aria-label={t`Browser`}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      <div className="flex items-center gap-1 border-b border-border p-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t`Back`}
          disabled={!page?.canGoBack}
          onClick={() => void send({ kind: "back" })}
        >
          <ArrowLeft aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t`Forward`}
          disabled={!page?.canGoForward}
          onClick={() => void send({ kind: "forward" })}
        >
          <ArrowRight aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t`Reload`}
          onClick={() => void send({ kind: "reload" })}
        >
          <RotateCw aria-hidden />
        </Button>
        <form
          className="min-w-0 flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            if (address?.trim()) void send({ kind: "navigate", url: address.trim() });
            setAddress(null);
          }}
        >
          <Input
            aria-label={t`Address`}
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={address ?? page?.url ?? ""}
            onChange={(event) => setAddress(event.target.value)}
          />
        </form>
        <Button type="button" onClick={() => void handBack()}>
          {t`Hand back`}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="px-3 py-2 text-body-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="relative flex min-h-0 flex-1 justify-center overflow-hidden bg-muted">
        {page?.image ? (
          <img
            src={page.image}
            alt={page.title || t`Page`}
            draggable={false}
            className="h-full max-w-full cursor-pointer touch-none object-contain object-top"
            onPointerDown={(event) => {
              press.current = { x: event.clientX, y: event.clientY };
            }}
            onPointerUp={(event) => {
              const start = press.current;
              press.current = null;
              if (!start) return;
              keyboard.current?.focus();
              const point = at(event);
              const moved = { x: event.clientX - start.x, y: event.clientY - start.y };
              // A swipe scrolls the page the way a finger drags it; a short press is a tap.
              if (Math.hypot(moved.x, moved.y) < SWIPE_PX) void send({ kind: "tap", ...point });
              else void send({ kind: "scroll", ...point, dx: -moved.x * 2, dy: -moved.y * 2 });
            }}
            onWheel={(event) => void send({ kind: "scroll", ...at(event), dx: event.deltaX, dy: event.deltaY })}
          />
        ) : (
          <Spinner className="self-center" />
        )}
        <textarea
          ref={keyboard}
          aria-label={t`Type on the page`}
          autoCapitalize="off"
          autoCorrect="off"
          className="absolute bottom-0 left-0 size-px opacity-0"
          onKeyDown={onKeyDown}
          onChange={(event) => {
            const text = event.target.value;
            event.target.value = "";
            if (text) void send({ kind: "text", text });
          }}
        />
      </div>
    </div>
  );
}
