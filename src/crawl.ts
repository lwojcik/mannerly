import type {
  CrawlPagesOptions,
  CrawlPagesResult,
  IncompleteReason,
} from '@mannerly/crawl.types';
import { BlockedError, DeadlineError, ScrapeError } from '@mannerly/errors';
import type { MannerlyLogger } from '@mannerly/types';
export type {
  CrawlPagesOptions,
  CrawlPagesResult,
  IncompleteReason,
  PageStats,
  PageVisit,
} from '@mannerly/crawl.types';

const recover = async <T, R>(
  promise: Promise<T>,
  onError: (error: unknown) => R,
): Promise<R | T> => {
  try {
    return await promise;
  } catch (error) {
    return onError(error);
  }
};

type PageRecord<S> = CrawlPagesResult<S>['pages'][number];

type PageOutcome<S> =
  | { ended: IncompleteReason; failure?: { page: number; error: ScrapeError } }
  | { record: PageRecord<S>; signature: string; last: boolean };

const reasonFor = (error: ScrapeError): IncompleteReason => {
  if (error instanceof BlockedError) {
    return 'blocked';
  }

  return error instanceof DeadlineError ? 'deadline' : 'page-failed';
};

const readPage = async <P, S>(
  options: CrawlPagesOptions<P, S>,
  page: number,
) => {
  const response = await options.fetchPage(options.urlFor(page), page);

  try {
    return { response, parsed: options.parse(response.body, page) };
  } catch (error) {
    throw error instanceof ScrapeError ? error.withBody(response.body) : error;
  }
};

const readPageOrFail = <P, S>(options: CrawlPagesOptions<P, S>, page: number) =>
  recover(readPage(options, page), (error: unknown) => {
    if (!(error instanceof ScrapeError)) {
      throw error;
    }

    if (error.body) {
      options.onSnapshot?.(`list-page-${page}`, error.body);
    }

    if (page === 1 || options.strict) {
      throw error;
    }

    return error;
  });

interface EndedByRepeatOptions {
  logger: MannerlyLogger;
  page: number;
  empty: boolean;
}

const endedByRepeat = ({
  logger,
  page,
  empty,
}: EndedByRepeatOptions): { ended: IncompleteReason } => {
  if (empty) {
    return { ended: 'empty-page' };
  }

  logger.warn(
    'page identical to the previous one; pagination parameter ignored',
    { page },
  );

  return { ended: 'pagination-ignored' };
};

const crawlOne = async <P, S>({
  options,
  page,
  previous,
}: {
  options: CrawlPagesOptions<P, S>;
  page: number;
  previous: string | null;
}): Promise<PageOutcome<S>> => {
  const { logger } = options;

  if (page > options.maxPages) {
    return { ended: 'cap' };
  }

  const read = await readPageOrFail(options, page);

  if (read instanceof ScrapeError) {
    logger.warn('list page failed', {
      page,
      error: read.name,
      message: read.message,
    });

    return { ended: reasonFor(read), failure: { page, error: read } };
  }

  const { parsed, response } = read;

  if (logger.verbose) {
    options.onSnapshot?.(`list-page-${page}`, response.body);
  }

  const items = options.itemsOf(parsed);
  const signature = JSON.stringify(items);

  if (items.length === 0 || signature === previous) {
    return endedByRepeat({ logger, page, empty: items.length === 0 });
  }

  const visit = options.visit({ parsed, page, response });

  return {
    signature,
    last: visit.stop,
    record: {
      page,
      status: response.status,
      bytes: response.bytes,
      items: items.length,
      durationMs: response.durationMs,
      ...visit.stats,
    },
  };
};

/**
 * Reads page 1, 2, 3 and so on, parses each and stops when the list ends.
 *
 * It stops at `maxPages`, at an empty page, at a page identical to the previous one
 * (a site that ignores the page number), or when `visit` returns `stop: true`.
 * A failure on page 1 throws. A failure later ends the crawl and is returned in `failure`
 * (unless `strict`, which throws). Check `complete` before treating the result as the whole list.
 *
 * @example
 * const result = await crawlPages({
 *   maxPages: 20,
 *   strict: false,
 *   logger,
 *   urlFor: (page) => `https://example.org/events?page=${page}`,
 *   fetchPage: (url) => http.get(url, { marker: 'id="event-list"' }),
 *   parse: (body) => parseEvents(body),
 *   itemsOf: (events) => events,
 *   visit: ({ parsed }) => ({ stop: false, stats: { count: parsed.length } }),
 * });
 */
export const crawlPages = async <P, S>(
  options: CrawlPagesOptions<P, S>,
): Promise<CrawlPagesResult<S>> => {
  const result: CrawlPagesResult<S> = {
    complete: true,
    incompleteReason: null,
    pages: [],
    failure: null,
  };
  // eslint-disable-next-line no-restricted-syntax -- carried from one page of the loop below to the next
  let previous: string | null = null;

  // eslint-disable-next-line no-restricted-syntax -- sequential on purpose: one page at a time, each decides whether to fetch the next
  for (let page = 1; ; page++) {
    const outcome: PageOutcome<S> = await crawlOne({
      options,
      page,
      previous,
    });

    if ('ended' in outcome) {
      Object.assign(result, {
        complete: false,
        incompleteReason: outcome.ended,
        failure: outcome.failure ?? null,
      });
      break;
    }

    previous = outcome.signature;
    // eslint-disable-next-line functional/immutable-data -- the crawl's result, filled by the page loop
    result.pages.push(outcome.record);

    if (outcome.last) {
      break;
    }
  }

  return result;
};
