import { describe, expect, it } from 'vitest';

import {
  BlockedError,
  DeadlineError,
  describeFailure,
  EmptyPageError,
  FetchError,
  isKnownScrapeError,
  type KnownScrapeError,
  MalformedPageError,
  MovedError,
  NotFoundError,
  ScrapeError,
  UnexpectedPageError,
} from '@mannerly/errors';

describe('errors', () => {
  it('carry a name, status and body', () => {
    const error = new MovedError('/new', 301);

    expect(error).toMatchObject({
      name: 'MovedError',
      status: 301,
      newPath: '/new',
      body: null,
    });
    expect(new ScrapeError('x').withBody('<html>').body).toBe('<html>');
    expect(new BlockedError('blocked')).toMatchObject({
      name: 'BlockedError',
      status: null,
    });
    expect(new BlockedError('blocked')).toBeInstanceOf(ScrapeError);
  });
});

describe('describeFailure', () => {
  it('says so when the site blocked the request', () => {
    expect(describeFailure(new BlockedError('HTTP 403', 403))).toBe(
      'blocked: HTTP 403',
    );
    expect(describeFailure(new ScrapeError('HTTP 500', 500))).toBe('HTTP 500');
  });
});

describe('kind', () => {
  const kinds = (errors: KnownScrapeError[]) => errors.map(({ kind }) => kind);

  it('is a fixed string per class', () => {
    expect(
      kinds([
        new BlockedError('x'),
        new DeadlineError('x'),
        new EmptyPageError('x'),
        new FetchError('x'),
        new MalformedPageError('x'),
        new MovedError('/new'),
        new NotFoundError('x'),
        new UnexpectedPageError('x'),
      ]),
    ).toStrictEqual([
      'blocked',
      'deadline',
      'empty-page',
      'fetch',
      'malformed-page',
      'moved',
      'not-found',
      'unexpected-page',
    ]);
    expect(new ScrapeError('x').kind).toBe('scrape');
  });

  it('narrows the error in a switch', () => {
    const describeKind = (error: KnownScrapeError) => {
      switch (error.kind) {
        case 'moved': {
          return error.newPath;
        }

        default: {
          return error.kind;
        }
      }
    };

    expect(describeKind(new MovedError('/new'))).toBe('/new');
    expect(describeKind(new FetchError('x'))).toBe('fetch');
  });
});

describe('isKnownScrapeError', () => {
  it('accepts mannerly errors only', () => {
    expect(isKnownScrapeError(new FetchError('x'))).toBe(true);
    expect(isKnownScrapeError(new ScrapeError('x'))).toBe(false);
    expect(isKnownScrapeError(new Error('x'))).toBe(false);
    expect(isKnownScrapeError('x')).toBe(false);
  });
});
