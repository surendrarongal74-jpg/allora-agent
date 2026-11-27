"""The live view of the page tools' tab, and a person's taps, swipes and keys on it.

`view` answers the front tab's address, title and a JPEG of what it shows. `drive` applies one input
from the person who took over, then answers the view. Both talk DevTools to the same browser the page
tools use, so the person and the bot see and move the same tab.
"""

from __future__ import annotations

from typing import Any, Callable
from urllib.parse import urlsplit

from page_secrets import CdpClient

# What the person sees is a phone; what the preview shows is shrunk to about a card's width.
PHONE_VIEWPORT = {"width": 390, "height": 844, "deviceScaleFactor": 2, "mobile": True}
PREVIEW_WIDTH = 720
TAKEOVER_WIDTH = 900
JPEG_QUALITY = 60
MAX_TEXT = 2000
MAX_WHEEL = 5000

# Keys a phone keyboard sends that are not text, with the codes Chromium expects.
KEYS: dict[str, tuple[str, int]] = {
    "Enter": ("Enter", 13),
    "Backspace": ("Backspace", 8),
    "Tab": ("Tab", 9),
    "Escape": ("Escape", 27),
    "ArrowLeft": ("ArrowLeft", 37),
    "ArrowUp": ("ArrowUp", 38),
    "ArrowRight": ("ArrowRight", 39),
    "ArrowDown": ("ArrowDown", 40),
    "Delete": ("Delete", 46),
}


class ViewError(RuntimeError):
    """An input the view refuses before it touches the page; the message is safe to show."""


def number(value: Any, low: float, high: float) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ViewError("Expected a number")
    return max(low, min(high, float(value)))


def attach(client: CdpClient, target: str) -> str:
    return str(client.call("Target.attachToTarget", {"targetId": target, "flatten": True})["sessionId"])


def view(client: CdpClient, session: str, *, width: int = PREVIEW_WIDTH) -> dict[str, Any]:
    metrics = client.call("Page.getLayoutMetrics", session_id=session)
    viewport = metrics.get("cssVisualViewport") or metrics.get("cssLayoutViewport") or {}
    css_width = float(viewport.get("clientWidth") or 0) or 1280.0
    css_height = float(viewport.get("clientHeight") or 0) or 800.0
    shot = client.call("Page.captureScreenshot", {
        "format": "jpeg",
        "quality": JPEG_QUALITY,
        # Scaled so the image is never wider than the card that shows it.
        "clip": {"x": float(viewport.get("pageX") or 0), "y": float(viewport.get("pageY") or 0),
                 "width": css_width, "height": css_height, "scale": min(1.0, width / css_width)},
    }, session_id=session, timeout_s=8.0)
    state = client.call("Runtime.evaluate", {
        "expression": "[location.href, document.title]", "returnByValue": True,
    }, session_id=session)
    href, title = ((state.get("result") or {}).get("value") or ["", ""])[:2]
    history = client.call("Page.getNavigationHistory", session_id=session)
    index = int(history.get("currentIndex") or 0)
    entries = history.get("entries") or []
    data = str(shot.get("data") or "")
    return {
        "ok": True,
        "url": str(href or ""),
        "title": str(title or ""),
        "image": f"data:image/jpeg;base64,{data}" if data else None,
        "viewport": {"width": round(css_width), "height": round(css_height)},
        "canGoBack": index > 0,
        "canGoForward": index < len(entries) - 1,
    }


def drive(client: CdpClient, session: str, step: dict[str, Any], check_url: Callable[[str], None]) -> None:
    """One input from the person. Coordinates are CSS pixels of the visible viewport."""
    kind = step.get("kind")
    if kind == "tap":
        x, y = number(step.get("x"), 0, 10000), number(step.get("y"), 0, 10000)
        for event in ("mouseMoved", "mousePressed", "mouseReleased"):
            client.call("Input.dispatchMouseEvent", {
                "type": event, "x": x, "y": y, "button": "none" if event == "mouseMoved" else "left",
                "clickCount": 0 if event == "mouseMoved" else 1,
            }, session_id=session)
    elif kind == "scroll":
        client.call("Input.dispatchMouseEvent", {
            "type": "mouseWheel", "x": number(step.get("x"), 0, 10000), "y": number(step.get("y"), 0, 10000),
            "deltaX": number(step.get("dx", 0), -MAX_WHEEL, MAX_WHEEL),
            "deltaY": number(step.get("dy", 0), -MAX_WHEEL, MAX_WHEEL),
        }, session_id=session)
    elif kind == "text":
        text = step.get("text")
        if not isinstance(text, str) or not text or len(text) > MAX_TEXT:
            raise ViewError("Expected text")
        client.call("Input.insertText", {"text": text}, session_id=session)
    elif kind == "key":
        key = KEYS.get(str(step.get("key") or ""))
        if key is None:
            raise ViewError("Unknown key")
        name, code = key
        down: dict[str, Any] = {"type": "keyDown", "key": name, "code": name, "windowsVirtualKeyCode": code}
        if name == "Enter":
            down["text"] = "\r"
        client.call("Input.dispatchKeyEvent", down, session_id=session)
        client.call("Input.dispatchKeyEvent", {"type": "keyUp", "key": name, "code": name,
                                               "windowsVirtualKeyCode": code}, session_id=session)
    elif kind == "navigate":
        url = str(step.get("url") or "").strip()
        if url and "://" not in url:
            url = f"https://{url}"
        if urlsplit(url).scheme not in ("http", "https"):
            raise ViewError("Only web addresses can be opened")
        check_url(url)
        client.call("Page.navigate", {"url": url}, session_id=session, timeout_s=20.0)
    elif kind in ("back", "forward"):
        history = client.call("Page.getNavigationHistory", session_id=session)
        index = int(history.get("currentIndex") or 0) + (-1 if kind == "back" else 1)
        entries = history.get("entries") or []
        if 0 <= index < len(entries):
            client.call("Page.navigateToHistoryEntry", {"entryId": entries[index]["id"]}, session_id=session)
    elif kind == "reload":
        client.call("Page.reload", session_id=session, timeout_s=20.0)
    elif kind == "phone":
        client.call("Emulation.setDeviceMetricsOverride", PHONE_VIEWPORT, session_id=session)
        client.call("Emulation.setTouchEmulationEnabled", {"enabled": True, "maxTouchPoints": 5},
                    session_id=session)
    elif kind == "desktop":
        client.call("Emulation.clearDeviceMetricsOverride", session_id=session)
        client.call("Emulation.setTouchEmulationEnabled", {"enabled": False}, session_id=session)
    else:
        raise ViewError("Unknown input")


def run(ws_url: str, target: str, command: str, args: dict[str, Any],
        check_url: Callable[[str], None]) -> dict[str, Any]:
    client = CdpClient(ws_url)
    client.connect()
    try:
        session = attach(client, target)
        client.call("Page.enable", session_id=session)
        if command == "drive":
            step = args.get("input")
            if not isinstance(step, dict):
                raise ViewError("Expected an input")
            drive(client, session, step, check_url)
        return view(client, session, width=TAKEOVER_WIDTH if command == "drive" or args.get("large") else PREVIEW_WIDTH)
    finally:
        client.close()
