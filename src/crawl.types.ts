import type { ScrapeError } from '@mannerly/errors';
import type { PageResponse } from '@mannerly/types';
import type { MannerlyLogger } from '@mannerly/types';

/**
 * Why a crawl ended before the list was read to its end.
 * - `page-failed`: a page after the first failed (see `failure`)
 * - `blocked`: a page threw `BlockedError` (stop and back off, see `nextCooldown`)
 * - `deadline`: `DeadlineError`
 * - `cap`: `maxPages` was reached
 * - `pagination-ignored`: a page was identical to the previous one
 * - `empty-page`: a page had no items
 */
export type IncompleteReason =
  | 'page-failed'
  | 'blocked'
  | 'deadline'
  | 'cap'
  | 'pagination-ignored'
  | 'empty-page';

/** What `crawlPages` records about each page it read. */
export interface PageStats {
  page: number;
  status: number;
  bytes: number;
  /** How many items `itemsOf` found on the page. */
  items: number;
  durationMs: number;
}

/** What `visit` returns for a page. */
export interface PageVisit<S> {
  /** True to end the crawl after this page, counted as complete. */
  stop: boolean;
  /** Merged into this page's entry in `CrawlPagesResult.pages`. */
  stats: S;
}

/** Options of `crawlPages`. `P` is what `parse` returns; `S` is your per-page stats. */
export interface CrawlPagesOptions<P, S> {
  /** The crawl stops after this many pages (`incompleteReason: 'cap'`). */
  maxPages: number;
  /** When true, a failure on any page throws. When false, only a failure on page 1 throws; later ones end the crawl and are returned in `failure`. */
  strict: boolean;
  logger: MannerlyLogger;
  /** The URL of page number `page` (1-based). */
  urlFor: (page: number) => string;
  /** Fetches one page, normally `(url) => http.get(url, { marker })`. */
  fetchPage: (url: string, page: number) => Promise<PageResponse>;
  /** Parses a body. May throw a `ScrapeError` (e.g. `MalformedPageError`); it is then handled like a fetch failure. */
  parse: (body: string, page: number) => P;
  /** The items on a parsed page. An empty list ends the crawl; a list identical to the previous page's means the site ignores the page number. */
  itemsOf: (parsed: P) => unknown[];
  /** Called for each non-empty, new page. Use it to collect results and to decide whether to go on. */
  visit: (options: {
    parsed: P;
    page: number;
    response: PageResponse;
  }) => PageVisit<S>;
  /** Receives the HTML of a failed page, or of every page when `logger.verbose` is true, for debugging. */
  onSnapshot?: (name: string, html: string) => void;
}

/** What `crawlPages` resolves with. */
export interface CrawlPagesResult<S> {
  /** True when the crawl ended because `visit` said stop. False means the list may not have been read to its end. */
  complete: boolean;
  /** Why it ended early; null when `complete`. */
  incompleteReason: IncompleteReason | null;
  /** One entry per page read successfully. */
  pages: (PageStats & S)[];
  /** The error that ended the crawl, with its page number; null otherwise. */
  failure: { page: number; error: ScrapeError } | null;
}
