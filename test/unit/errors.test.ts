import { describe, expect, it } from 'vitest';

import {
  BlockedError,
  describeFailure,
  MovedError,
  ScrapeError,
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
