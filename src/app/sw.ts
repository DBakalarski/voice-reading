import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkFirst, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Custom runtime caching rules prepended before defaultCache so they take priority.
// These ensure the app shell HTML pages are cached and served offline regardless of
// query-string parameters (e.g. /exercise?id=foo and /exercise?id=bar both resolve
// to the same cached /exercise shell).
const customRuntimeCaching = [
  // Cache the /exercise HTML shell ignoring the ?id= query string.
  // One cached copy serves every exercise id offline.
  {
    matcher: ({ url, request }: { url: URL; request: Request }) =>
      url.pathname === "/exercise" || url.pathname === "/exercise.html",
    handler: new NetworkFirst({
      cacheName: "exercise-shell",
      matchOptions: { ignoreSearch: true },
    }),
  },
  // Cache the home page (/) so it is available offline.
  {
    matcher: ({ url, request }: { url: URL; request: Request }) =>
      url.pathname === "/" || url.pathname === "/index.html",
    handler: new NetworkFirst({
      cacheName: "home-shell",
      matchOptions: { ignoreSearch: true },
    }),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [...customRuntimeCaching, ...defaultCache],
});

serwist.addEventListeners();
