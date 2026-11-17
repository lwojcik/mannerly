import {
  BlockedError,
  FetchError,
  MovedError,
  NotFoundError,
  type ScrapeError,
  UnexpectedPageError,
} from '@mannerly/errors';
import { HTTP_STATUS } from '@mannerly/http-status';
import { retryAfterMs } from '@mannerly/retry-after';
import { MS_PER_SECOND } from '@mannerly/time';
import type { ClientConfig, RawResponse } from '@mannerly/types';

interface CheckResponseOptions {
  options: Pick<ClientConfig, 'settings' | 'isMoved' | 'now'>;
  url: string;
  requestedPath: string;
  response: RawResponse;
}

const retryOnStatus = ({
  options,
  url,
  response: { status, headers },
}: Omit<CheckResponseOptions, 'requestedPath'>) => {
  const retryAfter = retryAfterMs(headers, options.now());

  if (retryAfter !== null && retryAfter > options.settings.maxRetryAfterMs) {
    throw new BlockedError(
      `Retry-After ${Math.round(retryAfter / MS_PER_SECOND)}s is too long: ${url}`,
      status,
    );
  }

  return {
    error: new FetchError(`HTTP ${status}: ${url}`, status),
    retryAfter,
  };
};

export const checkResponse = ({
  options,
  url,
  requestedPath,
  response,
}: CheckResponseOptions): {
  error: ScrapeError;
  retryAfter: number | null;
} | null => {
  const { isMoved } = options;
  const { status, finalUrl } = response;

  if (status === HTTP_STATUS.NOT_FOUND || status === HTTP_STATUS.GONE) {
    throw new NotFoundError(`Not found: ${url}`, status);
  }

  if (status === HTTP_STATUS.FORBIDDEN) {
    throw new BlockedError(`Blocked (403): ${url}`, status);
  }

  if (status < HTTP_STATUS.OK || status >= HTTP_STATUS.MULTIPLE_CHOICES) {
    return retryOnStatus({ options, url, response });
  }

  const finalPath = new URL(finalUrl).pathname;

  if (finalPath !== requestedPath) {
    if (isMoved?.(requestedPath, finalPath)) {
      throw new MovedError(finalPath, status);
    }

    return {
      error: new UnexpectedPageError(
        `Redirected to ${finalPath}: ${url}`,
        status,
      ),
      retryAfter: null,
    };
  }

  return null;
};
