import { HTTP_STATUS } from '@mannerly/http-status';

export const REDIRECT_STATUSES = new Set<number>([
  HTTP_STATUS.MOVED_PERMANENTLY,
  HTTP_STATUS.FOUND,
  HTTP_STATUS.SEE_OTHER,
  HTTP_STATUS.TEMPORARY_REDIRECT,
  HTTP_STATUS.PERMANENT_REDIRECT,
]);
export const LOGGED_HEADERS = [
  'content-type',
  'content-length',
  'retry-after',
  'location',
];
