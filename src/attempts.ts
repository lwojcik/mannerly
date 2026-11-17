import { FetchError, ScrapeError } from '@mannerly/errors';
import type { Pacer } from '@mannerly/pacer';
import type { RawResponse, Verdict } from '@mannerly/types';

const trySend = async (
  send: () => Promise<RawResponse>,
): Promise<{ response: RawResponse } | { failure: FetchError }> => {
  try {
    return { response: await send() };
  } catch (error) {
    if (error instanceof ScrapeError) {
      throw error;
    }

    return {
      failure: new FetchError(
        `Network error: ${error instanceof Error ? error.message : String(error)}`,
      ),
    };
  }
};

export const attemptLoop = async <T>({
  url,
  maxRetries,
  pacer,
  send,
  validate,
}: {
  url: string;
  maxRetries: number;
  pacer: Pacer;
  send: () => Promise<RawResponse>;
  validate: (response: RawResponse) => Verdict<T>;
}): Promise<{ value: T; attempts: number }> => {
  // eslint-disable-next-line no-restricted-syntax -- carried across the retries of the loop below
  let attempt = 0;
  // eslint-disable-next-line no-restricted-syntax -- carried across the retries of the loop below
  let lastError: ScrapeError = new FetchError(`No attempt made for ${url}`);

  // eslint-disable-next-line no-restricted-syntax -- sequential on purpose: retries with backoff, one request at a time
  while (attempt <= maxRetries) {
    const sent = await trySend(send);
    const verdict: Verdict<T> =
      'response' in sent ? validate(sent.response) : { error: sent.failure };

    if ('value' in verdict) {
      return { value: verdict.value, attempts: attempt + 1 };
    }

    if ('again' in verdict) {
      continue;
    }

    lastError = verdict.error;
    attempt++;
    await pacer.backoff({
      attempt,
      maxRetries,
      error: lastError,
      retryAfter: verdict.retryAfter ?? null,
    });
  }

  throw lastError;
};
