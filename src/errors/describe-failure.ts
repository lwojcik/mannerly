import { BlockedError } from '@mannerly/errors/BlockedError';
import type { ScrapeError } from '@mannerly/errors/ScrapeError';

export const describeFailure = (error: ScrapeError) =>
  error instanceof BlockedError ? `blocked: ${error.message}` : error.message;
