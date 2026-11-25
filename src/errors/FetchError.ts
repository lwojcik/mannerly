import { ScrapeError } from '@mannerly/errors/ScrapeError';

/**
 * A transient failure. It is retried up to `maxRetries` times and thrown only
 * when the last attempt failed too. Causes: a network error or timeout, a 5xx or 429
 * (or any other non-2xx) answer, a truncated page, a body that is not JSON.
 *
 * `status` is null for a network error.
 */
export class FetchError extends ScrapeError {
  override readonly kind = 'fetch';
}
