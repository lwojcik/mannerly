import type { ScrapeError } from '@mannerly/errors';

/** A `fetch`-compatible function. Pass your own via `HttpClientOptions.fetch` to change transport or to fake the network in tests. */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** Structured fields attached to a log line. */
export interface LogFields {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * What the client needs from a logger. Silent by default.
 *
 * Cookie values are passed to `addSecret` so a redacting logger can keep them out of its output.
 */
export interface MannerlyLogger {
  /** When true, `crawlPages` also snapshots every page it reads via `onSnapshot`. */
  verbose: boolean;
  debug: (message: string, fields?: LogFields) => void;
  warn: (message: string, fields?: LogFields) => void;
  addSecret: (value: string | undefined) => void;
}

/** Tunable behaviour of an `HttpClient`. Pass any subset as `HttpClientOptions.settings`; the rest keep their defaults (`DEFAULT_SETTINGS`). */
export interface HttpSettings {
  /**
   * The least time between two requests on one client, in ms.
   * @default 2000
   */
  minRequestIntervalMs: number;
  /**
   * Up to this much random time is added to `minRequestIntervalMs`, in ms.
   * @default 1000
   */
  requestJitterMs: number;
  /**
   * One request is aborted after this long, in ms. The abort is a network error, so it is retried.
   * @default 30000
   */
  requestTimeoutMs: number;
  /**
   * Retries after the first attempt (so up to `maxRetries + 1` requests). 0 means a single attempt.
   * @default 3
   */
  maxRetries: number;
  /**
   * The first backoff, in ms. It doubles on each retry, or is replaced by `Retry-After` when that is longer.
   * @default 2000
   */
  backoffBaseMs: number;
  /**
   * A `Retry-After` longer than this, in ms, is treated as a block: `BlockedError` is thrown at once instead of waiting.
   * @default 120000
   */
  maxRetryAfterMs: number;
  /**
   * Redirect hops followed by hand.
   * @default 5
   */
  maxRedirects: number;
  /**
   * How many characters of a bad body go into the debug log.
   * @default 300
   */
  logBodyPreviewChars: number;
}

/** Per-site options: what to send and how to read redirects. */
export interface SiteHttpOptions {
  /** Sent with every request. Put an identifying `User-Agent` here, e.g. `my-bot (+https://example.org/bot)`. */
  headers?: Record<string, string>;
  /**
   * Says that a redirect from `requestedPath` to `finalPath` (both URL paths, not full URLs) is an expected move.
   * When it returns true the client throws `MovedError` (not retried). Any other redirect to a different path
   * is an `UnexpectedPageError`, which is retried.
   */
  isMoved?: (requestedPath: string, finalPath: string) => boolean;
}

/**
 * Options of `new HttpClient(options)`. All are optional.
 *
 * @example
 * const http = new HttpClient({
 *   headers: { 'User-Agent': 'my-bot (+https://example.org/bot)' },
 *   settings: { minRequestIntervalMs: 5000 },
 * });
 */
export interface HttpClientOptions extends SiteHttpOptions {
  /** Replaces the global `fetch`, e.g. another transport or a fake in a test. */
  fetch?: FetchLike;
  /** Replaces the real sleep. In tests pass `async () => {}` to skip all waiting. */
  sleep?: (ms: number) => Promise<void>;
  /** Replaces `Date.now()`. */
  now?: () => number;
  /** Replaces `Math.random()`, which drives the request jitter. */
  random?: () => number;
  /** Receives debug and warning lines. Silent by default. */
  logger?: MannerlyLogger;
  /** Any of the `HttpSettings`; the rest keep their defaults. */
  settings?: Partial<HttpSettings>;
  /**
   * A timestamp in ms (same clock as `now`). Rather than sleep past it, the client throws `DeadlineError`.
   * @default null (no deadline)
   */
  deadlineAt?: number | null;
  /** When the previous request was made, in ms, to keep the spacing across clients or processes. */
  lastRequestAt?: number | null;
  /** Called with the time of each request just before it is sent, e.g. to persist it for `lastRequestAt`. */
  onRequest?: (at: number) => void;
}

export interface ClientConfig extends SiteHttpOptions {
  headers: Record<string, string>;
  fetch: FetchLike;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  random: () => number;
  logger: MannerlyLogger;
  settings: HttpSettings;
  deadlineAt: number | null;
  lastRequestAt: number | null;
  onRequest?: (at: number) => void;
}

/**
 * How `get()` tells a body was not cut short (used only together with `marker`):
 * a RegExp the body must match, a predicate that returns true for a complete body,
 * or `false` to skip the check. When it is not given, the body must end with `</html>`.
 */
export type CompleteCheck = RegExp | ((body: string) => boolean) | false;

/**
 * Options of `http.get(url, options)`.
 *
 * @example
 * await http.get(url, { marker: 'id="event-list"' });
 * await http.get(feedUrl, { marker: '<feed', complete: /<\/feed>\s*$/ });
 */
export interface GetOptions {
  /**
   * A string the page must contain. A page without it (a maintenance page, a login wall, a homepage)
   * is an `UnexpectedPageError`, which is retried. Setting it also turns on the completeness check (see `complete`).
   * Leave it out and neither check is made.
   */
  marker?: string;
  /** How to tell the body was not cut short. A body that fails is a `FetchError`, which is retried. Ignored without `marker`. */
  complete?: CompleteCheck;
  /** Overrides `settings.maxRetries` for this request. 0 means a single attempt. */
  maxRetries?: number;
}

/**
 * Options of `http.json(url, options)`.
 *
 * @example
 * await http.json(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: 'x' }) });
 */
export interface JsonOptions {
  /** @default 'GET' */
  method?: 'GET' | 'POST';
  /** Added to the client's `headers` for this request. Set `Content-Type` yourself when you send a body. */
  headers?: Record<string, string>;
  /** The request body, already serialised (the client does not call `JSON.stringify` for you). */
  body?: string;
  /** Overrides `settings.maxRetries` for this request. 0 means a single attempt. */
  maxRetries?: number;
}

/** What `http.json()` resolves with. */
export interface JsonResponse {
  /** The URL that was requested. */
  url: string;
  status: number;
  /** The parsed JSON. It is `unknown`: validate or narrow it before use. */
  data: unknown;
  /** Size of the body in bytes. */
  bytes: number;
  /** Time from the first attempt to the answer, including waits between retries. */
  durationMs: number;
  /** How many requests it took (1 = no retry). */
  attempts: number;
}

export interface RequestSpec {
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body: string | undefined;
}

export const GET: RequestSpec = { method: 'GET', headers: {}, body: undefined };

/** What `http.get()` resolves with. */
export interface PageResponse {
  /** The URL that was requested. */
  url: string;
  /** The URL after redirects. */
  finalUrl: string;
  status: number;
  /** The page as text. */
  body: string;
  /** Size of the body in bytes. */
  bytes: number;
  /** Time from the first attempt to the answer, including waits between retries. */
  durationMs: number;
  /** How many requests it took (1 = no retry). */
  attempts: number;
}

export interface RawResponse {
  status: number;
  headers: Headers;
  body: string;
  bytes: number;
  finalUrl: string;
  sentCookies: boolean;
}

export type Verdict<T> =
  | { value: T }
  | { error: ScrapeError; retryAfter?: number | null }
  | { again: true };
