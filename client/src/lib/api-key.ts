// When the server has CLIPSYNC_API_KEY set, every /api call needs it. Ask once, keep it in
// this browser, and add it to same-origin /api requests. Behind Cloudflare Access the key
// still applies: Access decides who reaches the app, the key protects the API itself.
const STORAGE_KEY = "clipsync-api-key";

function readKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function isApiUrl(input: RequestInfo | URL): boolean {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
  return url.origin === location.origin && url.pathname.startsWith("/api/");
}

export function installApiKeyFetch() {
  const original = window.fetch.bind(window);
  let asking = false;
  window.fetch = async (input, init) => {
    if (!isApiUrl(input)) return original(input, init);
    const withKey = () => {
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      const key = readKey();
      if (key) headers.set("X-API-Key", key);
      return original(input, { ...init, headers });
    };
    const res = await withKey();
    if (res.status !== 401 || asking) return res;
    asking = true;
    const entered = window.prompt("ClipSync API key (from the server's .env):")?.trim();
    asking = false;
    if (!entered) return res;
    try {
      localStorage.setItem(STORAGE_KEY, entered);
    } catch {
      /* private window: the key lasts for this request only */
    }
    return withKey();
  };
}
