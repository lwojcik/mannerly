import type { ScrapeError } from '@mannerly/errors';

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface LogFields {
  [key: string]: string | number | boolean | null | undefined;
}

export interface MannerlyLogger {
  verbose: boolean;
  debug: (message: string, fields?: LogFields) => void;
  warn: (message: string, fields?: LogFields) => void;
  addSecret: (value: string | undefined) => void;
}

export interface HttpSettings {
  minRequestIntervalMs: number;
  requestJitterMs: number;
  requestTimeoutMs: number;
  maxRetries: number;
  backoffBaseMs: number;
  maxRetryAfterMs: number;
  maxRedirects: number;
  logBodyPreviewChars: number;
}

export interface SiteHttpOptions {
  headers?: Record<string, string>;
  isMoved?: (requestedPath: string, finalPath: string) => boolean;
}

export interface HttpClientOptions extends SiteHttpOptions {
  fetch?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
  logger?: MannerlyLogger;
  settings?: Partial<HttpSettings>;
  deadlineAt?: number | null;
  lastRequestAt?: number | null;
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

export interface GetOptions {
  marker?: string;
  maxRetries?: number;
}

export interface JsonOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  maxRetries?: number;
}

export interface JsonResponse {
  url: string;
  status: number;
  data: unknown;
  bytes: number;
  durationMs: number;
  attempts: number;
}

export interface RequestSpec {
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body: string | undefined;
}

export const GET: RequestSpec = { method: 'GET', headers: {}, body: undefined };

export interface PageResponse {
  url: string;
  finalUrl: string;
  status: number;
  body: string;
  bytes: number;
  durationMs: number;
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
