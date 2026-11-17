import type { ScrapeError } from '@mannerly/errors';
import type { PageResponse } from '@mannerly/types';
import type { MannerlyLogger } from '@mannerly/types';

export type IncompleteReason =
  | 'page-failed'
  | 'blocked'
  | 'deadline'
  | 'cap'
  | 'pagination-ignored'
  | 'empty-page';

export interface PageStats {
  page: number;
  status: number;
  bytes: number;
  items: number;
  durationMs: number;
}

export interface PageVisit<S> {
  stop: boolean;
  stats: S;
}

export interface CrawlPagesOptions<P, S> {
  maxPages: number;
  strict: boolean;
  logger: MannerlyLogger;
  urlFor: (page: number) => string;
  fetchPage: (url: string, page: number) => Promise<PageResponse>;
  parse: (body: string, page: number) => P;
  itemsOf: (parsed: P) => unknown[];
  visit: (options: {
    parsed: P;
    page: number;
    response: PageResponse;
  }) => PageVisit<S>;
  onSnapshot?: (name: string, html: string) => void;
}

export interface CrawlPagesResult<S> {
  complete: boolean;
  incompleteReason: IncompleteReason | null;
  pages: (PageStats & S)[];
  failure: { page: number; error: ScrapeError } | null;
}
