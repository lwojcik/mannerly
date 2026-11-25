import { ScrapeError } from '@mannerly/errors/ScrapeError';

/**
 * Waiting for the next request or retry would pass `deadlineAt`, so the client
 * gave up instead of sleeping. Never retried. `status` is null.
 */
export class DeadlineError extends ScrapeError {}
