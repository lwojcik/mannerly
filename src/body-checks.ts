/* eslint-disable security/detect-unsafe-regex -- the text is a page or feed this run fetched, never a request, and the patterns are anchored or bounded */

import { FetchError, UnexpectedPageError } from '@mannerly/errors';
import type { MannerlyLogger } from '@mannerly/types';
import type { RawResponse, Verdict } from '@mannerly/types';

const COMPLETE_PAGE = /<\/html>\s*(?:<!--[\S\s]*?-->\s*)*$/i;

interface CheckPageBodyOptions {
  logger: MannerlyLogger;
  previewChars: number;
  url: string;
  response: RawResponse;
  marker: string;
}

export const checkPageBody = ({
  logger,
  previewChars,
  url,
  response,
  marker,
}: CheckPageBodyOptions): Verdict<RawResponse> => {
  const { status, body } = response;

  if (!body.includes(marker)) {
    logger.debug('page check failed: marker missing', {
      marker,
      preview: body.slice(0, previewChars),
    });

    return {
      error: new UnexpectedPageError(
        `Unexpected page (marker "${marker}" missing): ${url}`,
        status,
      ).withBody(body),
    };
  }

  if (!COMPLETE_PAGE.test(body)) {
    logger.debug('page check failed: truncated', {
      preview: body.slice(-previewChars),
    });

    return {
      error: new FetchError(`Truncated page: ${url}`, status).withBody(body),
    };
  }

  return { value: response };
};

interface ParseJsonBodyOptions {
  logger: MannerlyLogger;
  previewChars: number;
  url: string;
  response: RawResponse;
}

export const parseJsonBody = ({
  logger,
  previewChars,
  url,
  response,
}: ParseJsonBodyOptions): Verdict<{ response: RawResponse; data: unknown }> => {
  try {
    return { value: { response, data: JSON.parse(response.body) } };
  } catch {
    logger.debug('response check failed: not JSON', {
      preview: response.body.slice(0, previewChars),
    });

    return {
      error: new FetchError(
        response.body.trim() === ''
          ? `Empty response: ${url}`
          : `Not JSON: ${url}`,
        response.status,
      ).withBody(response.body),
    };
  }
};
