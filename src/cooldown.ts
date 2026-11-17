import { MS_PER_DAY } from '@mannerly/time';

export interface Cooldown {
  blockedUntil: string;
  blockStrikes: number;
}

interface NextCooldownOptions {
  state: { blockStrikes: number };
  now: number;
  days: readonly number[];
}

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
