import { MS_PER_SECOND } from '@mannerly/time';

export const retryAfterMs = (headers: Headers, now: number): number | null => {
  const value = headers.get('retry-after');

  if (!value) {
    return null;
  }

  const seconds = Number(value);

  if (Number.isFinite(seconds)) {
    return seconds * MS_PER_SECOND;
  }

  const date = Date.parse(value);

  return Number.isNaN(date) ? null : Math.max(0, date - now);
};
