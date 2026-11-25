import { describe, expect, it } from 'vitest';

import { retryAfterMs } from '@mannerly/retry-after';

const NOW = Date.parse('2026-01-01T00:00:00Z');
const parse = (value?: string) =>
  retryAfterMs(
    new Headers(value === undefined ? {} : { 'retry-after': value }),
    NOW,
  );

describe('retryAfterMs', () => {
  it('returns null when the header is missing', () => {
    expect(parse()).toBeNull();
  });

  it('reads delay-seconds', () => {
    expect(parse('120')).toBe(120_000);
    expect(parse('0')).toBe(0);
  });

  it('reads an HTTP date relative to now', () => {
    expect(parse('Thu, 01 Jan 2026 00:01:00 GMT')).toBe(60_000);
  });

  it('never returns a negative delay for a date in the past', () => {
    expect(parse('Wed, 31 Dec 2025 23:00:00 GMT')).toBe(0);
  });

  it.each(['-5', '1.5', '1e3', '0x10', 'Infinity', 'soon'])(
    'ignores the malformed value %s',
    (value) => {
      expect(parse(value)).toBeNull();
    },
  );
});
