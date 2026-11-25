import { ScrapeError } from '@mannerly/errors/ScrapeError';

/**
 * The site kept answering with an empty body, even after the client dropped
 * its cookies and started a fresh session. The first empty answer is not an
 * error: it is taken as a session warm-up and retried. This is thrown only
 * once those retries are used up.
 */
export class EmptyPageError extends ScrapeError {
  override readonly kind = 'empty-page';
}
