# AGENTS.md

mannerly is a dependency-free fetch client for polite scraping (pacing, retries, `Retry-After`, typed errors). ESM only, Node >= 24, TypeScript.

## Commands

```sh
npm ci
npm test                # vitest, TZ=UTC
npm run test:coverage   # thresholds are 100% for lines, functions, branches and statements
npm run typecheck
npm run lint
npm run format          # prettier --write; `format:check` is what CI and the pre-commit hook run
npm run build           # tsdown -> dist/
```

The pre-commit hook runs `format:check`, `typecheck`, `lint` and `test`. Run them before you finish.

## Layout

- `index.ts` is the public entry point. Anything not exported there is private.
- `src/` holds the implementation. Import between files with the `@mannerly/*` alias (maps to `src/*`), not relative paths.
- `src/errors/` has one class per file, all extending `ScrapeError`. Re-export new ones from `src/errors/index.ts`.
- `src/types.ts` holds the public option and response types; `src/crawl.types.ts` the crawler's.
- `test/unit/` mirrors `src/`. Tests inject `fetch`, `sleep`, `now` and `random`, so they never touch the network or wait. See `test/unit/capture-logger.ts`.

## How a request flows

`HttpClient.get/json` -> `attemptLoop` (`attempts.ts`) -> `Transport.send` (pacing, cookies, manual redirects) -> `checkResponse` / `checkPageBody` return a verdict: a value, an error to retry (with an optional `retryAfter`), or `again`. A check that **throws** a `ScrapeError` (`BlockedError`, `NotFoundError`, `MovedError`, `DeadlineError`) ends the request without retries; a verdict error is retried with backoff and thrown when the retries run out.

When you add a failure mode, decide which of the two it is, and document it in the error's JSDoc.

## Conventions

- Public API changes need JSDoc (with `@default` for settings) and a matching update to `README.md` and `llms.txt`. The `.d.mts` files are what agents read in `node_modules`.
- Coverage must stay at 100%; add tests with the code.
- No runtime dependencies. Do not add any.
- ESLint is strict and has rules against `let`, mutation and loops; where a loop or `let` is the right tool, the code uses a targeted `eslint-disable` with a reason. Follow that pattern, do not disable rules wholesale.
- Commits and PR titles follow Conventional Commits (`feat:`, `fix:`, `chore:`...), enforced by commitlint and CI. Releases are cut by `release-it` from those messages, so do not edit `CHANGELOG` or the version by hand.
- Do not make the client quicker or less polite by default. The defaults (2 s spacing, stop on 403) are the point of the package.
