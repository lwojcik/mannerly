import { BlockedError } from '@mannerly/errors/BlockedError';
import type { ScrapeError } from '@mannerly/errors/ScrapeError';

/** A one-line description of an error for logs; a block is prefixed with `blocked:`. */
export const describeFailure = (error: ScrapeError) =>
  error instanceof BlockedError ? `blocked: ${error.message}` : error.message;
