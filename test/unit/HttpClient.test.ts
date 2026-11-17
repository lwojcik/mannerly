import { describe, expect, it } from 'vitest';

import {
  BlockedError,
  DeadlineError,
  EmptyPageError,
  FetchError,
  MovedError,
  NotFoundError,
  UnexpectedPageError,
} from '@mannerly/errors';
import { HttpClient, type HttpSettings } from '@mannerly/HttpClient.class';

import { captureLogger } from './capture-logger';

const PAGE = "<html><body><div class='item-list'></div></body></html>";
const ITEM = 'https://example.org/shop/items/2026-11-15-1700';

const SETTINGS: HttpSettings = {
  minRequestIntervalMs: 4_000,
  requestJitterMs: 2_000,
  requestTimeoutMs: 30_000,
  maxRetries: 4,
  backoffBaseMs: 5_000,
  maxRetryAfterMs: 120_000,
  maxRedirects: 5,
  logBodyPreviewChars: 300,
};
const HEADERS = { 'User-Agent': 'test-agent', Accept: 'text/html' };
const ITEM_PATH = /^\/shop\/items\/[\w-]+$/;
const isMoved = (from: string, to: string) =>
  ITEM_PATH.test(from) && ITEM_PATH.test(to);

class FakeClock {
  t = Date.parse('2026-10-23T10:00:00.000Z');
  now = () => this.t;
  sleep = async (ms: number) => {
    this.t += ms;
  };
}

type Step =
  | {
      status?: number;
      body?: string;
      headers?: Record<string, string | string[]>;
    }
  | Error;

const scripted = (steps: Step[]) => {
  const inits: RequestInit[] = [];
  const calls: {
    url: string;
    cookie: string | null;
    userAgent: string | null;
    signal: boolean;
    redirect: string | undefined;
  }[] = [];

  const fetch = async (url: string, init: RequestInit) => {
    inits.push(init);
    calls.push({
      url,
      cookie: new Headers(init.headers).get('cookie'),
      userAgent: new Headers(init.headers).get('user-agent'),
      signal: init.signal instanceof AbortSignal,
      redirect: init.redirect,
    });
    const step = steps.shift() ?? { body: PAGE };

    if (step instanceof Error || typeof step === 'string') {
      throw step;
    }

    const headers = new Headers();

    Object.entries(step.headers ?? {}).forEach(([name, value]) =>
      [value].flat().forEach((item) => headers.append(name, item)),
    );

    return new Response(step.body ?? '', {
      status: step.status ?? 200,
      headers,
    });
  };

  return { fetch, calls, inits };
};

const client = (
  steps: Step[],
  options: {
    deadlineAt?: number | null;
    verbose?: boolean;
    lastRequestAt?: number;
    isMoved?: ((from: string, to: string) => boolean) | null;
  } = {},
) => {
  const clock = new FakeClock();
  const { fetch, calls, inits } = scripted(steps);
  const { logger, lines } = captureLogger(options.verbose ?? true);
  const sleeps: number[] = [];
  const http = new HttpClient({
    headers: HEADERS,
    isMoved:
      options.isMoved === null ? undefined : (options.isMoved ?? isMoved),
    fetch,
    sleep: async (ms) => {
      sleeps.push(ms);
      await clock.sleep(ms);
    },
    now: clock.now,
    random: () => 0.5,
    logger,
    settings: SETTINGS,
    deadlineAt: options.deadlineAt === undefined ? null : options.deadlineAt,
    lastRequestAt: options.lastRequestAt,
  });

  return { http, calls, inits, clock, sleeps, lines, logger };
};

const cookies = {
  'set-cookie': [
    'SESSIONID=abc123def456; Path=/; HttpOnly',
    'TRACKING=track987654; Path=/',
    'bad-cookie',
  ],
};

describe('HttpClient', () => {
  it('treats the empty first response as the session warm-up and retries with the cookies', async () => {
    const { http, calls, lines } = client([
      { body: '', headers: cookies },
      { body: PAGE },
    ]);
    const page = await http.get('https://example.org/list?x=1', {
      marker: 'item-list',
    });

    expect(page).toMatchObject({ status: 200, body: PAGE, attempts: 1 });
    expect(calls.map((call) => call.cookie)).toEqual([
      null,
      'SESSIONID=abc123def456; TRACKING=track987654',
    ]);
    expect(
      calls.every((call) => call.signal && call.redirect === 'manual'),
    ).toBe(true);
    expect(http.warmUps).toBe(1);
    expect(lines.join('\n')).toContain('session warm-up');
    expect(lines.join('\n')).not.toContain('abc123def456');
  });

  it('warms up even when the empty first response sets no cookies', async () => {
    const { http, lines } = client([{ body: '' }, { body: PAGE }]);

    await http.get('https://example.org/list', {
      marker: 'item-list',
    });
    expect(lines.join('\n')).toContain('session warm-up cookies=none');
  });

  it('resets the session when a page comes back empty despite cookies', async () => {
    const { http, calls } = client([
      { body: '', headers: cookies },
      { body: '' },
      { body: '', headers: cookies },
      { body: PAGE },
    ]);

    await http.get('https://example.org/list', {
      marker: 'item-list',
    });
    expect(calls.map((call) => call.cookie !== null)).toEqual([
      false,
      true,
      false,
      true,
    ]);
  });

  it('gives up with EmptyPageError when pages stay empty', async () => {
    const steps = Array.from({ length: 20 }, () => ({
      body: '',
      headers: cookies,
    }));
    const { http } = client(steps);

    await expect(
      http.get('https://example.org/list', { marker: 'item-list' }),
    ).rejects.toBeInstanceOf(EmptyPageError);
  });

  it('spaces requests by the minimum interval plus jitter, also across clients', async () => {
    const { http, sleeps } = client(
      [{ body: '', headers: cookies }, { body: PAGE }, { body: PAGE }],
      { lastRequestAt: Date.parse('2026-10-23T09:59:59Z') },
    );

    await http.get('https://example.org/a', { marker: 'item-list' });
    await http.get('https://example.org/a', { marker: 'item-list' });
    expect(sleeps).toEqual([4000, 5000, 5000]);
  });

  it.each([429, 500, 503, 400])(
    'retries %i with exponential backoff, then throws FetchError',
    async (status) => {
      const { http, sleeps, calls } = client([
        { body: '', headers: cookies },
        ...Array.from({ length: 5 }, () => ({ status, body: 'x' })),
      ]);

      await expect(
        http.get('https://example.org/a', { marker: 'm' }),
      ).rejects.toBeInstanceOf(FetchError);
      expect(calls).toHaveLength(6);
      expect(sleeps.filter((ms) => ms !== 5000)).toEqual([10000, 20000, 40000]);
    },
  );

  it('honours Retry-After in seconds and as a date', async () => {
    const { http, sleeps } = client([
      { body: '', headers: cookies },
      { status: 503, headers: { 'retry-after': '60' } },
      {
        status: 503,
        headers: {
          'retry-after': new Date(
            Date.parse('2026-10-23T10:02:00Z'),
          ).toUTCString(),
        },
      },
      { status: 503, headers: { 'retry-after': 'soon' } },
      { body: PAGE },
    ]);

    await http.get('https://example.org/a', { marker: 'item-list' });
    expect(sleeps).toContain(60000);
    expect(sleeps.some((ms) => ms > 45000 && ms < 60000)).toBe(true);
  });

  it('treats 403 and a too-long Retry-After as a block', async () => {
    await expect(
      client([{ body: '', headers: cookies }, { status: 403 }]).http.get(
        'https://example.org/a',
        { marker: 'm' },
      ),
    ).rejects.toBeInstanceOf(BlockedError);
    await expect(
      client([
        { body: '', headers: cookies },
        { status: 429, headers: { 'retry-after': '121' } },
      ]).http.get('https://example.org/a', { marker: 'm' }),
    ).rejects.toBeInstanceOf(BlockedError);
  });

  it.each([404, 410])(
    'throws NotFoundError on %i without retrying',
    async (status) => {
      const { http, calls } = client([
        { body: '', headers: cookies },
        { status },
      ]);

      await expect(
        http.get('https://example.org/a', { marker: 'm' }),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(calls).toHaveLength(2);
    },
  );

  it('retries network errors and timeouts', async () => {
    const { http } = client([
      new TypeError('fetch failed'),
      new DOMException('timed out', 'TimeoutError'),
      { body: '', headers: cookies },
      { body: PAGE },
    ]);

    await expect(
      http.get('https://example.org/a', { marker: 'item-list' }),
    ).resolves.toMatchObject({ attempts: 3 });
    const failing = client(
      Array.from({ length: 6 }, () => 'boom' as unknown as Error),
    );

    await expect(
      failing.http.get('https://example.org/a', { marker: 'm' }),
    ).rejects.toThrow(/Network error: boom/);
  });

  it('follows redirects by hand, keeping cookies from every hop', async () => {
    const { http, calls } = client([
      { status: 302, headers: { location: '/a', ...cookies } },
      { body: PAGE },
    ]);
    const page = await http.get('https://example.org/a', {
      marker: 'item-list',
    });

    expect(page.finalUrl).toBe('https://example.org/a');
    expect(calls[1].cookie).toContain('SESSIONID');
  });

  it('stops after too many redirects', async () => {
    const steps = Array.from({ length: 10 }, () => ({
      status: 301,
      headers: { location: '/a' },
    }));

    await expect(
      client(steps).http.get('https://example.org/a', { marker: 'm' }),
    ).rejects.toThrow(/Too many redirects/);
  });

  it('raises MovedError when an item redirects to another item', async () => {
    const { http } = client([
      { body: '', headers: cookies },
      { status: 301, headers: { location: `${ITEM}-1` } },
      { body: PAGE },
    ]);
    const error = await http
      .get(ITEM, { marker: 'm' })
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(MovedError);
    expect(error.newPath).toBe('/shop/items/2026-11-15-1700-1');
  });

  it('treats a move as an unexpected page when the site defines no moves', async () => {
    const { http } = client(
      [
        { body: '', headers: cookies },
        ...Array.from({ length: 5 }, () => [
          { status: 301, headers: { location: `${ITEM}-1` } },
          { body: PAGE },
        ]).flat(),
      ],
      { isMoved: null },
    );

    await expect(http.get(ITEM, { marker: 'm' })).rejects.toBeInstanceOf(
      UnexpectedPageError,
    );
  });

  it("sends the site's headers with every request", async () => {
    const { http, calls } = client([
      { body: '', headers: cookies },
      { body: PAGE },
    ]);

    await http.get('https://example.org/a', { marker: 'item-list' });
    expect(calls.map((call) => call.userAgent)).toEqual([
      'test-agent',
      'test-agent',
    ]);
  });

  it('treats a redirect to the homepage or a login page as an unexpected page', async () => {
    const steps = [
      { body: '', headers: cookies },
      ...Array.from({ length: 5 }, () => [
        { status: 302, headers: { location: '/' } },
        { body: PAGE },
      ]).flat(),
    ];

    await expect(
      client(steps).http.get(ITEM, { marker: 'item-list' }),
    ).rejects.toBeInstanceOf(UnexpectedPageError);
  });

  it('rejects pages without the marker, and truncated pages, keeping the body for snapshots', async () => {
    const missing = await client([
      { body: '', headers: cookies },
      ...Array.from({ length: 5 }, () => ({
        body: '<html>maintenance</html>',
      })),
    ])
      .http.get('https://example.org/a', { marker: 'item-list' })
      .catch((caught) => caught);

    expect(missing).toBeInstanceOf(UnexpectedPageError);
    expect(missing.body).toContain('maintenance');
    const truncated = await client([
      { body: '', headers: cookies },
      ...Array.from({ length: 5 }, () => ({
        body: "<html><div class='item-list'>",
      })),
    ])
      .http.get('https://example.org/a', { marker: 'item-list' })
      .catch((caught) => caught);

    expect(truncated).toBeInstanceOf(FetchError);
    expect(truncated.message).toContain('Truncated');
  });

  it('accepts comments after </html>, such as a page cache appends', async () => {
    const body =
      "<html><div class='item-list'></div></html>\n<!-- cache generated: 2026-10-27 18:38:03 -->  \n<!-- b -->\n";
    const { http } = client([{ body: '', headers: cookies }, { body }]);

    expect(
      (
        await http.get('https://example.org/a', {
          marker: 'item-list',
        })
      ).body,
    ).toBe(body);
    const after = await client([
      { body: '', headers: cookies },
      ...Array.from({ length: 5 }, () => ({
        body: '<html>item-list</html><!-- a --><div>',
      })),
    ])
      .http.get('https://example.org/a', { marker: 'item-list' })
      .catch((caught) => caught);

    expect(after.message).toContain('Truncated');
  });

  it('decodes the body as UTF-8 from the raw bytes', async () => {
    const body = '<html>Zażółć gęślą jaźń item-list</html>';
    const { http } = client([
      { body: '', headers: cookies },
      { body, headers: { 'content-type': 'text/html; charset=iso-8859-2' } },
    ]);

    expect(
      (
        await http.get('https://example.org/a', {
          marker: 'item-list',
        })
      ).body,
    ).toBe(body);
  });

  it('skips the page checks when no marker is given', async () => {
    const { http } = client([{ body: 'plain text, not html' }]);

    await expect(http.get('https://example.org/a')).resolves.toMatchObject({
      body: 'plain text, not html',
    });
    expect(http.requestCount).toBe(1);
  });

  it('allows no retries when asked (for a probe during a cool-down)', async () => {
    const { http, calls } = client([
      { body: '', headers: cookies },
      { status: 500 },
    ]);

    await expect(
      http.get('https://example.org/a', { marker: 'm', maxRetries: 0 }),
    ).rejects.toBeInstanceOf(FetchError);
    expect(calls).toHaveLength(2);
  });

  it('throws DeadlineError instead of waiting past the deadline', async () => {
    const deadlineAt = Date.parse('2026-10-23T10:00:03Z');
    const { http } = client([{ body: '', headers: cookies }, { body: PAGE }], {
      deadlineAt,
    });

    await expect(
      http.get('https://example.org/a', { marker: 'item-list' }),
    ).rejects.toBeInstanceOf(DeadlineError);
    const late = client([], { deadlineAt: Date.parse('2026-10-23T09:00:00Z') });

    await expect(
      late.http.get('https://example.org/a', { marker: 'm' }),
    ).rejects.toBeInstanceOf(DeadlineError);
  });

  describe('json', () => {
    const API = 'https://api.example.org/v1/events';

    it('sends the method, body and its own headers on top of the site headers', async () => {
      const { http, inits } = client([{ body: '[{"a":1}]' }]);

      const response = await http.json(API, {
        method: 'POST',
        body: '{}',
        headers: { Accept: 'application/json', Authorization: 'key-123' },
      });

      expect(response).toMatchObject({
        status: 200,
        data: [{ a: 1 }],
        attempts: 1,
        bytes: 9,
      });
      const headers = new Headers(inits[0].headers);

      expect(inits[0]).toMatchObject({
        method: 'POST',
        body: '{}',
        redirect: 'manual',
      });
      expect(headers.get('accept')).toBe('application/json');
      expect(headers.get('authorization')).toBe('key-123');
      expect(headers.get('user-agent')).toBe('test-agent');
    });

    it('defaults to GET without a body', async () => {
      const { http, lines } = client([{ body: '{"ok":true}' }]);

      await expect(http.json(API)).resolves.toMatchObject({
        data: { ok: true },
      });
      expect(lines.join('\n')).toContain('method=GET');
    });

    it('retries an empty or non-JSON body and keeps the last body for snapshots', async () => {
      const ok = client([
        { body: '' },
        { body: '<html>busy</html>' },
        { body: '[]' },
      ]);

      await expect(ok.http.json(API)).resolves.toMatchObject({
        data: [],
        attempts: 3,
      });
      const failing = await client(
        Array.from({ length: 5 }, () => ({ body: 'not json' })),
      )
        .http.json(API)
        .catch((caught) => caught);

      expect(failing).toBeInstanceOf(FetchError);
      expect(failing.message).toContain('Not JSON');
      expect(failing.body).toBe('not json');
      const empty = await client(
        Array.from({ length: 5 }, () => ({ body: ' ' })),
      )
        .http.json(API, { maxRetries: 0 })
        .catch((caught) => caught);

      expect(empty.message).toContain('Empty response');
    });

    it('retries HTTP errors with backoff, keeping the error body', async () => {
      const { http, calls, sleeps } = client(
        Array.from({ length: 3 }, () => ({
          status: 500,
          body: '{"message":"Service unavailable"}',
        })),
      );
      const error = await http
        .json(API, { maxRetries: 2 })
        .catch((caught) => caught);

      expect(error).toBeInstanceOf(FetchError);
      expect(error.status).toBe(500);
      expect(error.body).toContain('Service unavailable');
      expect(calls).toHaveLength(3);
      expect(sleeps.filter((ms) => ms !== 5000)).toEqual([10000]);
    });

    it('throws at once on 403, 404 and a redirect to another item', async () => {
      await expect(
        client([{ status: 403 }]).http.json(API),
      ).rejects.toBeInstanceOf(BlockedError);
      await expect(
        client([{ status: 404 }]).http.json(API),
      ).rejects.toBeInstanceOf(NotFoundError);
      const moved = client([
        { status: 301, headers: { location: `${ITEM}-1` } },
      ]);

      await expect(moved.http.json(ITEM)).rejects.toBeInstanceOf(MovedError);
    });

    it('retries network errors and redirects to other pages', async () => {
      const { http } = client([
        new TypeError('fetch failed'),
        { status: 302, headers: { location: '/' } },
        { body: '[]' },
        { body: '[]' },
      ]);

      await expect(http.json(API)).resolves.toMatchObject({ attempts: 3 });
      await expect(
        client(['boom' as unknown as Error]).http.json(API, { maxRetries: 0 }),
      ).rejects.toThrow(/Network error: boom/);
    });

    it('stops at the deadline', async () => {
      const late = client([], {
        deadlineAt: Date.parse('2026-10-23T09:00:00Z'),
      });

      await expect(late.http.json(API)).rejects.toBeInstanceOf(DeadlineError);
    });
  });

  it('logs every request, redirect, response and retry in verbose mode', async () => {
    const { http, lines } = client([
      { status: 302, headers: { location: '/a' } },
      { body: '', headers: cookies },
      { status: 500 },
      { body: PAGE },
    ]);

    await http.get('https://example.org/a', { marker: 'item-list' });
    const log = lines.join('\n');

    [
      'request',
      'redirect',
      'response',
      'retry',
      'wait',
      'setCookie=SESSIONID,TRACKING',
    ].forEach((word) => expect(log).toContain(word));
  });
});
