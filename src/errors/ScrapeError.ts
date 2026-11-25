/**
 * The value of `ScrapeError.kind`: one per error class, in kebab-case. A plain
 * `ScrapeError` has the kind `scrape`.
 */
export type ScrapeErrorKind =
  | 'blocked'
  | 'deadline'
  | 'empty-page'
  | 'fetch'
  | 'malformed-page'
  | 'moved'
  | 'not-found'
  | 'scrape'
  | 'unexpected-page';

/**
 * Base class of every error mannerly throws. Catch it to handle all failures,
 * or use `instanceof` on a subclass to react to a specific one.
 *
 * Whether an error was retried before it reached you depends on its class; see each subclass.
 * `name` is the class name, so it is safe to log and compare.
 *
 * To tell the errors apart, switch on `kind` (see `KnownScrapeError`) instead of
 * chaining `instanceof`. `kind` is a fixed string that survives minification and
 * duplicate copies of the package, which `instanceof` and `name` do not.
 */
export class ScrapeError extends Error {
  /** Which error this is. A fixed string per class; see `ScrapeErrorKind`. */
  readonly kind: ScrapeErrorKind = 'scrape';
  /** The HTTP status that caused the error, or null when there was none (network error, deadline). */
  status: number | null;
  /** The body of the page that failed, when there is one, for debugging or snapshots. */
  body: string | null = null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = new.target.name;
    this.status = status;
  }

  /** Attaches the failing page's body and returns the same error. */
  withBody(body: string) {
    this.body = body;

    return this;
  }
}
