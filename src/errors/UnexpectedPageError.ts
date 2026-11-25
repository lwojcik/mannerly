import { ScrapeError } from '@mannerly/errors/ScrapeError';

/**
 * The page is not the one that was asked for: the `marker` is missing
 * (a maintenance page, a login wall) or the request was redirected to another path
 * that `isMoved` does not accept. Retried, then thrown. `body` holds the page.
 */
export class UnexpectedPageError extends ScrapeError {
  override readonly kind = 'unexpected-page';
}
