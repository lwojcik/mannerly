import { describe, expect, it } from 'vitest';

import { nextCooldown } from '@mannerly/cooldown';

describe('cool-down', () => {
  it('backs off 1, 2, 4, then at most 8 days', () => {
    const now = Date.parse('2026-10-23T00:00:00Z');
    const days = [0, 1, 2, 3, 4, 7].map(
      (strikes) =>
        (Date.parse(
          nextCooldown({
            state: { blockStrikes: strikes },
            now,
            days: [1, 2, 4, 8],
          }).blockedUntil,
        ) -
          now) /
        86_400_000,
    );

    expect(days).toEqual([1, 2, 4, 8, 8, 8]);
    expect(
      nextCooldown({ state: { blockStrikes: 2 }, now, days: [1, 2, 4, 8] })
        .blockStrikes,
    ).toBe(3);
  });
});
