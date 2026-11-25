import type {
  ClientConfig,
  HttpClientOptions,
  HttpSettings,
  MannerlyLogger,
} from '@mannerly/types';

/** The defaults of every `HttpSettings` field. Spread it to derive your own: `{ ...DEFAULT_SETTINGS, maxRetries: 1 }`. */
export const DEFAULT_SETTINGS: HttpSettings = {
  minRequestIntervalMs: 2000,
  requestJitterMs: 1000,
  requestTimeoutMs: 30_000,
  maxRetries: 3,
  backoffBaseMs: 2000,
  maxRetryAfterMs: 120_000,
  maxRedirects: 5,
  logBodyPreviewChars: 300,
};

const noop = (): void => {};

export const SILENT_LOGGER: MannerlyLogger = {
  verbose: false,
  debug: noop,
  warn: noop,
  addSecret: noop,
};

export const resolveOptions = (options: HttpClientOptions): ClientConfig => ({
  headers: {},
  fetch: (url, init) => fetch(url, init),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
  // eslint-disable-next-line sonarjs/pseudo-random -- request jitter, not security
  random: () => Math.random(),
  logger: SILENT_LOGGER,
  deadlineAt: null,
  lastRequestAt: null,
  ...Object.fromEntries(
    Object.entries(options).filter(([, value]) => value !== undefined),
  ),
  settings: { ...DEFAULT_SETTINGS, ...options.settings },
});
