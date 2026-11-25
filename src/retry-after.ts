import { MS_PER_SECOND } from '@mannerly/time';

const DELAY_SECONDS = /^\d+$/;
const HTTP_DATE = /[a-z]/i;

export const retryAfterMs = (headers: Headers, now: number): number | null => {
  const value = headers.get('retry-after');

  if (!value) {
    return null;
  }

  if (DELAY_SECONDS.test(value)) {
    return Number(value) * MS_PER_SECOND;
  }

  const date = HTTP_DATE.test(value) ? Date.parse(value) : NaN;

  return Number.isNaN(date) ? null : Math.max(0, date - now);
};
