import { describe, expect, it } from 'vitest';

import { crawlPages, type CrawlPagesOptions } from '@mannerly/crawl';
import {
  BlockedError,
  DeadlineError,
  FetchError,
  MalformedPageError,
} from '@mannerly/errors';
import type { PageResponse } from '@mannerly/types';

import { captureLogger } from './capture-logger';

type Page = string | Error;

const response = (url: string, body: string): PageResponse => ({
  url,
  finalUrl: url,
  status: 200,
  body,
  bytes: body.length,
  durationMs: 100,
  attempts: 1,
});

const setUp = (
  pages: Page[],
  options: {
    verbose?: boolean;
    stopAfter?: number;
    strict?: boolean;
    maxPages?: number;
  } = {},
) => {
  const { logger, lines } = captureLogger(options.verbose ?? false);
  const fetched: number[] = [];
  const visited: string[][] = [];
  const snapshots: string[] = [];
  const crawlOptions: CrawlPagesOptions<string[], { first: string }> = {
    maxPages: options.maxPages ?? 10,
    strict: options.strict ?? false,
    logger,
    urlFor: (page) => `https://example.test/list/${page}`,
    fetchPage: async (url, page) => {
      fetched.push(page);
      const body = pages[page - 1] ?? '';

      if (body instanceof Error) {
        throw body;
      }

      return response(url, body);
    },
    parse: (body) => {
      if (body.includes('!')) {
        throw new MalformedPageError('unreadable page');
      }

      if (body === 'boom') {
        throw new TypeError('a bug');
      }

      return body ? body.split(',') : [];
    },
    itemsOf: (items) => items,
    visit: ({ parsed: items, page }) => {
      visited.push(items);

      return {
        stop: page === (options.stopAfter ?? pages.length),
        stats: { first: items[0] },
      };
    },
    onSnapshot: (name) => snapshots.push(name),
  };

  return {
    crawl: () => crawlPages(crawlOptions),
    fetched,
    visited,
    snapshots,
    lines,
  };
};

describe('crawlPages', () => {
  it('visits pages in order until the visit says stop, with per-page stats', async () => {
    const { crawl, fetched, visited } = setUp(['a,b', 'c', 'd'], {
      stopAfter: 2,
    });
    const result = await crawl();

    expect(result).toMatchObject({
      complete: true,
      incompleteReason: null,
      failure: null,
    });
    expect(fetched).toEqual([1, 2]);
    expect(visited).toEqual([['a', 'b'], ['c']]);
    expect(result.pages).toEqual([
      { page: 1, status: 200, bytes: 3, items: 2, durationMs: 100, first: 'a' },
      { page: 2, status: 200, bytes: 1, items: 1, durationMs: 100, first: 'c' },
    ]);
  });

  it.each([
    ['the cap', ['a', 'b', 'c'], { maxPages: 2 }, 'cap', [1, 2]],
    ['an empty page', ['a', ''], {}, 'empty-page', [1, 2]],
    [
      'a page identical to the previous one',
      ['a,b', 'a,b', 'c'],
      {},
      'pagination-ignored',
      [1, 2],
    ],
  ] as const)(
    'stops incomplete at %s',
    async (_name, pages, options, reason, fetchedPages) => {
      const { crawl, fetched } = setUp([...pages], options);

      expect(await crawl()).toMatchObject({
        complete: false,
        incompleteReason: reason,
      });
      expect(fetched).toEqual(fetchedPages);
    },
  );

  it('throws a failure on page 1, snapshotting a page it got but could not use', async () => {
    const unreadable = setUp(['!']);

    await expect(unreadable.crawl()).rejects.toBeInstanceOf(MalformedPageError);
    expect(unreadable.snapshots).toEqual(['list-page-1']);

    const failed = setUp([new FetchError('HTTP 500', 500)]);

    await expect(failed.crawl()).rejects.toBeInstanceOf(FetchError);
    expect(failed.snapshots).toEqual([]);
  });

  it('stops at a failure on a later page, keeping the pages before it', async () => {
    const cases = [
      [new FetchError('HTTP 500', 500), 'page-failed'],
      [new BlockedError('Blocked (403)', 403), 'blocked'],
      [new DeadlineError('deadline'), 'deadline'],
    ] as const;

    await Promise.all(
      cases.map(async ([error, reason]) => {
        const { crawl, lines } = setUp(['a', error, 'c']);
        const result = await crawl();

        expect(result).toMatchObject({
          complete: false,
          incompleteReason: reason,
        });
        expect(result.failure).toEqual({ page: 2, error });
        expect(result.pages).toHaveLength(1);
        expect(lines.join('\n')).toContain('list page failed');
      }),
    );
  });

  it('throws a later failure in strict mode, and any error that is not a ScrapeError', async () => {
    await expect(
      setUp(['a', '!'], { strict: true }).crawl(),
    ).rejects.toBeInstanceOf(MalformedPageError);
    await expect(setUp(['a', 'boom']).crawl()).rejects.toBeInstanceOf(
      TypeError,
    );
    const fetchBug = setUp([new TypeError('a bug in fetch')]);

    await expect(fetchBug.crawl()).rejects.toBeInstanceOf(TypeError);
  });

  it('snapshots every page in verbose mode', async () => {
    const { crawl, snapshots } = setUp(['a', 'b'], { verbose: true });

    await crawl();
    expect(snapshots).toEqual(['list-page-1', 'list-page-2']);
  });
});
