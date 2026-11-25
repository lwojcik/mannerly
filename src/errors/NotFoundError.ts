import { ScrapeError } from '@mannerly/errors/ScrapeError';

/**
 * The page does not exist: HTTP 404 or 410. Thrown at once, never retried.
 */
export class NotFoundError extends ScrapeError {}
