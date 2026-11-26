/**
 * What a signed-out visitor was about to do, kept across sign-in.
 *
 * The landing's search box sends a visitor to /start, which remembers the app
 * path they asked for (a search that runs on arrival, or a first request) in a
 * cookie before sending them to sign in. The URL carries it too (`?next=`),
 * but a URL is lost the moment someone closes the tab and comes back later
 * through "Sign in"; the cookie is not. /resume reads it after sign-in.
 */

export const PENDING_COOKIE = "intro_pending";
export const PENDING_MAX_AGE = 60 * 60 * 24 * 7;

/** Only these app paths may be resumed: never an arbitrary or external URL. */
const RESUMABLE = ["/search", "/new", "/home", "/leads", "/requests"];

export function isResumable(path: string | null | undefined): path is string {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.length > 1000) return false;
  const pathname = path.split(/[?#]/)[0];
  return RESUMABLE.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** The cookie's value from a raw Cookie header, or undefined. */
export function pendingFromCookieHeader(header: string | null | undefined): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name !== PENDING_COOKIE) continue;
    try {
      const value = decodeURIComponent(rest.join("="));
      return isResumable(value) ? value : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

const MODES = new Set(["companies", "people", "person", "news"]);
const MARKETS = /^[A-Z]{2}$/;

/**
 * The app path for a /start request. `to=new` opens a first request with the
 * sentence carried; anything else is a search that runs on arrival.
 */
export function pathForStart(params: URLSearchParams): string {
  const lang = params.get("lang") === "en" ? "en" : "ar";
  const q = (params.get("q") ?? "").trim().slice(0, 300);
  if (params.get("to") === "new") {
    const url = new URLSearchParams({ lang });
    if (q) url.set("q", q);
    return `/new?${url}`;
  }
  if (!q) return `/home?lang=${lang}`;
  const mode = MODES.has(params.get("mode") ?? "") ? params.get("mode")! : "companies";
  const market = MARKETS.test(params.get("market") ?? "") ? params.get("market")! : "SA";
  return `/search?${new URLSearchParams({ lang, mode, market, q, run: "1" })}`;
}
