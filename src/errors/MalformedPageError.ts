import { ScrapeError } from '@mannerly/errors/ScrapeError';

/**
 * The page was fetched fine, but its content is not what your parser expects.
 * For you to throw, not for mannerly: the client never throws it itself.
 * Throw it from the `parse` callback of `crawlPages`, which then treats it like
 * a failed fetch and keeps the page body on the error for debugging.
 */
export class MalformedPageError extends ScrapeError {}
