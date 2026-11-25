import { ScrapeError } from '@mannerly/errors/ScrapeError';

/**
 * The request was redirected to a path that `isMoved` accepts as a move.
 * Never retried. `newPath` is the path it ended on; update your stored URL.
 */
export class MovedError extends ScrapeError {
  override readonly kind = 'moved';
  newPath: string;

  constructor(newPath: string, status: number | null = null) {
    super(`Moved to ${newPath}`, status);
    this.newPath = newPath;
  }
}
