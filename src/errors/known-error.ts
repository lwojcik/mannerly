import type { BlockedError } from '@mannerly/errors/BlockedError';
import type { DeadlineError } from '@mannerly/errors/DeadlineError';
import type { EmptyPageError } from '@mannerly/errors/EmptyPageError';
import type { FetchError } from '@mannerly/errors/FetchError';
import type { MalformedPageError } from '@mannerly/errors/MalformedPageError';
import type { MovedError } from '@mannerly/errors/MovedError';
import type { NotFoundError } from '@mannerly/errors/NotFoundError';
import { ScrapeError } from '@mannerly/errors/ScrapeError';
import type { UnexpectedPageError } from '@mannerly/errors/UnexpectedPageError';

/**
 * Every error class mannerly has, as a union discriminated by `kind`. Narrow
 * an error to it, then `switch (error.kind)`; TypeScript knows which class
 * each case holds and can check you covered them all.
 *
 * @example
 * if (isKnownScrapeError(error)) {
 *   switch (error.kind) {
 *     case 'blocked':
 *       return stopAndBackOff();
 *     case 'moved':
 *       return updateUrl(error.newPath);
 *   }
 * }
 */
export type KnownScrapeError =
  | BlockedError
  | DeadlineError
  | EmptyPageError
  | FetchError
  | MalformedPageError
  | MovedError
  | NotFoundError
  | UnexpectedPageError;

/**
 * True for an error thrown by mannerly, narrowing it to `KnownScrapeError`.
 * False for anything else, and for a plain `ScrapeError` you made yourself.
 */
export const isKnownScrapeError = (error: unknown): error is KnownScrapeError =>
  error instanceof ScrapeError && error.kind !== 'scrape';
