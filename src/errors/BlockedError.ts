import { ScrapeError } from '@mannerly/errors/ScrapeError';

/**
 * The site is telling you to stop. Thrown at once, never retried, for a 403
 * or for a `Retry-After` longer than `settings.maxRetryAfterMs`.
 *
 * Do not retry: stop, record the block (see `nextCooldown`) and come back later.
 */
export class BlockedError extends ScrapeError {}
