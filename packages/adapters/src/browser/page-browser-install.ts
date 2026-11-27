import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { shellQuote } from "../computers/screens/computer-support.js";

/** The computer image's page-browser files: the API ships them in its source tree. */
const COMPUTER_DIR = path.join("infra", "sandboxes", "computer");

let computerDir: string | undefined;

function computerFile(name: string): string {
  if (!computerDir) {
    // Source, tests and the bundled server all sit somewhere below the repository root.
    for (let dir = path.dirname(fileURLToPath(import.meta.url)); ; dir = path.dirname(dir)) {
      const candidate = path.join(dir, COMPUTER_DIR);
      if (existsSync(path.join(candidate, "rakazo-page-browser"))) {
        computerDir = candidate;
        break;
      }
      if (path.dirname(dir) === dir) throw new Error(`${COMPUTER_DIR} is missing`);
    }
  }
  return readFileSync(path.join(computerDir, name), "utf8");
}

const asRoot = 'if [ "$(id -u)" -eq 0 ]; then root=""; else root="sudo -n"; fi';

/**
 * Installs the pinned agent-browser into /usr/local/bin with the computer image's own script.
 * It changes only when the pinned version does, so a provider's saved base image can carry it.
 */
export function installAgentBrowserCommand(): string {
  return [
    "set -eu",
    asRoot,
    `$root sh -c ${shellQuote(computerFile("install-agent-browser.sh"))} sh /usr/local/bin >/dev/null`,
  ].join("\n");
}

/**
 * Installs the pinned headless browser the page tools use by default, with the computer image's own
 * script. Like agent-browser it changes only with its pinned version.
 */
export function installHeadlessBrowserCommand(): string {
  return [
    "set -eu",
    asRoot,
    `$root sh -c ${shellQuote(computerFile("install-headless-browser.sh"))} sh /usr/local/bin >/dev/null`,
  ].join("\n");
}

/** The page-browser files, each with its mode and where the computer image keeps it. */
const PAGE_BROWSER_FILES = [
  ["rakazo-page-browser", 0o755, "/usr/local/bin/rakazo-page-browser"],
  ["rakazo-cdp-broker", 0o755, "/usr/local/bin/rakazo-cdp-broker"],
  ["page_secrets.py", 0o644, "/usr/local/lib/rakazo/page_secrets.py"],
  ["page_view.py", 0o644, "/usr/local/lib/rakazo/page_view.py"],
] as const;

/**
 * Writes the page-browser wrapper and its helpers where the computer image keeps them,
 * from this release's copy, unless they already match it. Small enough to run on every boot,
 * so a hosted computer always runs the helper its API was released with.
 */
export function installPageBrowserFilesCommand(): string {
  const files = Object.fromEntries(PAGE_BROWSER_FILES.map(([name]) => [name, computerFile(name)]));
  const hash = createHash("sha256");
  for (const [name] of PAGE_BROWSER_FILES) hash.update(files[name]!).update("\0");
  const version = hash.digest("hex");
  // One archive, so the files change together.
  const archive = gzipSync(JSON.stringify(files), { level: 9 }).toString("base64");
  const targets = PAGE_BROWSER_FILES.map(
    ([name, mode, target]) => `(${JSON.stringify(name)}, 0o${mode.toString(8)}, ${JSON.stringify(target)})`,
  ).join(", ");
  const unpack = [
    "import gzip, json, os, sys",
    "files = json.loads(gzip.decompress(sys.stdin.buffer.read()))",
    "os.makedirs('/usr/local/lib/rakazo', exist_ok=True)",
    `for name, mode, target in (${targets}):`,
    "    with open(target + '.new', 'w', encoding='utf-8') as file:",
    "        file.write(files[name])",
    "    os.chmod(target + '.new', mode)",
    "    os.replace(target + '.new', target)",
    `open('/usr/local/lib/rakazo/page-browser.version', 'w').write(${JSON.stringify(version)})`,
  ].join("\n");
  return [
    "set -eu",
    `if [ "$(cat /usr/local/lib/rakazo/page-browser.version 2>/dev/null)" = ${version} ]; then exit 0; fi`,
    asRoot,
    `printf '%s' ${shellQuote(archive)} | base64 -d | $root python3 -c ${shellQuote(unpack)}`,
  ].join("\n");
}

/** Everything a hosted Linux computer needs for the page tools; idempotent and cheap once done. */
export function installPageBrowserCommand(): string {
  // Without the headless browser the page tools use the desktop's Chromium, so its install may fail.
  return [
    `( ${installAgentBrowserCommand()}\n)`,
    `{ ( ${installHeadlessBrowserCommand()}\n) || true; }`,
    `( ${installPageBrowserFilesCommand()}\n)`,
  ].join(" && ");
}

/**
 * A page request's stdin on a hosted computer. It can carry saved logins and cards, so it waits in
 * a folder only the computer user can read, and the command removes it before the helper starts.
 */
export function privatePageInput() {
  const directory = `/tmp/rakazo-page-input-${randomUUID()}`;
  const file = `${directory}/request`;
  return {
    file,
    create: `mkdir -m 700 -- ${shellQuote(directory)}`,
    run: (command: string) =>
      `bash -c ${shellQuote(`exec 0< ${shellQuote(file)} || exit 1; rm -f -- ${shellQuote(file)} && rmdir -- ${shellQuote(directory)} || exit 1; ${command}`)}`,
    cleanup: `rm -f -- ${shellQuote(file)} && { rmdir -- ${shellQuote(directory)} 2>/dev/null || test ! -e ${shellQuote(directory)}; }`,
  };
}
