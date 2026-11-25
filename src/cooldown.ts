import { MS_PER_DAY } from '@mannerly/time';

/** A pause to store between runs. */
export interface Cooldown {
  /** ISO 8601 timestamp; do not hit the site again before it. */
  blockedUntil: string;
  /** How many blocks in a row so far. Feed it back as `state.blockStrikes` next time. */
  blockStrikes: number;
}

interface NextCooldownOptions {
  /** The stored state; use `{ blockStrikes: 0 }` for the first block. */
  state: { blockStrikes: number };
  /** The current time in ms. */
  now: number;
  /** Pause lengths in days, indexed by strike count. The last one repeats. */
  days: readonly number[];
}

/**
 * Turns repeated blocks (typically after a `BlockedError`) into a growing pause.
 * Pure: it stores nothing, so persist the result yourself.
 *
 * @example
 * const { blockedUntil, blockStrikes } = nextCooldown({
 *   state: { blockStrikes: 1 },
 *   now: Date.now(),
 *   days: [1, 2, 4, 8], // strike 1 pauses 2 days
 * });
 */
export const nextCooldown = ({
  state,
  now,
  days,
}: NextCooldownOptions): Cooldown => {
  const length = days[Math.min(state.blockStrikes, days.length - 1)];

  return {
    blockedUntil: new Date(now + length * MS_PER_DAY).toISOString(),
    blockStrikes: state.blockStrikes + 1,
  };
};
