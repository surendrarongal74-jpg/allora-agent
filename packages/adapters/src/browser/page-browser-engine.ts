/**
 * Which browser the page tools drive on a computer: its headless browser (the default, when the image
 * has one) or the desktop's visible Chromium. PAGE_BROWSER_ENGINE=desktop keeps the desktop's.
 */
export function resolvePageBrowserEngine(
  source: NodeJS.ProcessEnv = process.env,
): "headless" | "desktop" {
  return source.PAGE_BROWSER_ENGINE?.trim().toLowerCase() === "desktop" ? "desktop" : "headless";
}
