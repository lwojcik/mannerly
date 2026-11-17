# mannerly

[![npm version](https://img.shields.io/npm/v/mannerly)](https://www.npmjs.com/package/mannerly)

A fetch client with good manners. It spaces out its requests, honours `Retry-After`, backs off when a server struggles, stops when it is blocked and tells you exactly what went wrong.

Built for the jobs that read a site on a schedule: scrapers, feed builders, data pipelines. It has no dependencies and runs on Node 24 or newer.

## Install

```sh
npm install mannerly
```

## Use

```ts
import { HttpClient } from 'mannerly';

const http = new HttpClient({
  headers: { 'User-Agent': 'my-bot (+https://example.org/bot)' },
});

const page = await http.get('https://example.org/events', {
  marker: 'id="event-list"',
});

console.log(page.status, page.attempts, page.body.length);

const answer = await http.json('https://example.org/api/events?page=1');

console.log(answer.data);
```

Every request waits at least `minRequestIntervalMs` (plus some jitter) after the previous one, across all calls on the same client.

## What it does for you

- **Paces requests.** A minimum interval plus random jitter, so you never hammer a site. Pass `lastRequestAt` to keep the spacing across several clients or processes.
- **Retries what is worth retrying.** Network errors, timeouts and 5xx or 429 answers are retried with exponential backoff, up to `maxRetries`.
- **Honours `Retry-After`**, as seconds or as a date. A wait longer than `maxRetryAfterMs` is treated as a block, not waited out.
- **Stops when blocked.** A 403 throws `BlockedError` at once, without retries.
- **Sorts failures into typed errors**, all extending `ScrapeError`: `BlockedError`, `NotFoundError` (404 and 410), `FetchError`, `EmptyPageError`, `UnexpectedPageError`, `MovedError`, `DeadlineError`, `MalformedPageError`. Each carries the status, and, when there is one, the body of the page that failed.
- **Checks the page it got.** With a `marker`, a page that lacks it (a maintenance page, a login wall, a homepage) is an `UnexpectedPageError`, and an HTML page that ends early is a `FetchError`.
- **Follows redirects by hand**, so it can tell a redirect to a login page from a move you expect (`isMoved`).
- **Keeps a session.** Cookies from every hop are stored and sent back; an empty first answer is treated as a session warm-up and retried.
- **Respects a deadline.** Give it `deadlineAt` and it throws `DeadlineError` instead of sleeping past it.
- **Keeps secrets out of logs.** Cookie values are passed to your logger's `addSecret`, so a logger that redacts keeps them out of the output.

## Options

All of them are optional.

| Option                            | What it is                                                          |
| --------------------------------- | ------------------------------------------------------------------- |
| `headers`                         | Sent with every request (the User-Agent goes here).                 |
| `settings`                        | Any of the settings below.                                          |
| `isMoved(requestedPath, final)`   | Says that a redirect between two paths is a move, not a mistake.    |
| `deadlineAt`                      | A timestamp (ms) after which the client throws `DeadlineError`.     |
| `lastRequestAt`                   | When the previous request was made, to keep the spacing.            |
| `onRequest(at)`                   | Called before each request, e.g. to remember `lastRequestAt`.       |
| `logger`                          | `{ verbose, debug, warn, addSecret }`; silent by default.           |
| `fetch`, `sleep`, `now`, `random` | Replace the real thing, e.g. to use another transport or in a test. |

| Setting                | Default | Meaning                                   |
| ---------------------- | ------- | ----------------------------------------- |
| `minRequestIntervalMs` | 2000    | The least time between two requests.      |
| `requestJitterMs`      | 1000    | Up to this much random time is added.     |
| `requestTimeoutMs`     | 30000   | One request is aborted after this long.   |
| `maxRetries`           | 3       | Retries after the first attempt.          |
| `backoffBaseMs`        | 2000    | The first backoff; it doubles each time.  |
| `maxRetryAfterMs`      | 120000  | A longer `Retry-After` counts as a block. |
| `maxRedirects`         | 5       | Redirect hops followed by hand.           |
| `logBodyPreviewChars`  | 300     | How much of a bad body goes into the log. |

## Options of a single request

`http.get(url, options)` reads a page as text:

| Option       | What it is                                                                                                                                                                                           |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `marker`     | A string the page must contain. A page without it (a maintenance page, a login wall) is an `UnexpectedPageError`, and the page must also end with `</html>`. Leave it out and neither check is made. |
| `maxRetries` | Overrides the client's `maxRetries` for this request (0 means a single attempt).                                                                                                                     |

`http.json(url, options)` reads JSON and takes `method` (`GET` or `POST`), `headers` (added to the client's), `body` and `maxRetries`. A body that is empty or not JSON is retried like a failed request.

## Remember a block

`nextCooldown` turns repeated blocks into a growing pause you can store between runs:

```ts
import { nextCooldown } from 'mannerly';

const { blockedUntil, blockStrikes } = nextCooldown({
  state: { blockStrikes: 1 },
  now: Date.now(),
  days: [1, 2, 4, 8],
});
```

The first block pauses for the first number of days, the next for the second, and so on; the last one repeats.

## Walk a paged list

`crawlPages` fetches page 1, 2, 3 and so on, parses each one and stops when the list ends:

```ts
import { crawlPages } from 'mannerly';

const result = await crawlPages({
  maxPages: 20,
  strict: false,
  logger,
  urlFor: (page) => `https://example.org/events?page=${page}`,
  fetchPage: (url) => http.get(url, { marker: 'id="event-list"' }),
  parse: (body) => parseEvents(body),
  itemsOf: (events) => events,
  visit: ({ parsed }) => ({ stop: false, stats: { count: parsed.length } }),
});

console.log(result.complete, result.incompleteReason, result.pages);
```

It stops at the cap, at an empty page, or at a page identical to the previous one (a site that ignores the page number). A failure on page 1 throws; a failure later ends the crawl and is returned in `failure`, with the pages read so far.

## Be a good guest

mannerly makes a client polite; it does not make a request welcome. Identify yourself in the User-Agent, read the site's terms and `robots.txt`, and keep the interval long. A 403 is the site telling you to stop.

## Development

```sh
npm ci
npm test
npm run typecheck
npm run lint
npm run build
```
