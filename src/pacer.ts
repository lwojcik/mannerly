import { DeadlineError, type ScrapeError } from '@mannerly/errors';
import type { ClientConfig } from '@mannerly/types';

type PacerOptions = Pick<
  ClientConfig,
  | 'settings'
  | 'now'
  | 'random'
  | 'sleep'
  | 'logger'
  | 'deadlineAt'
  | 'lastRequestAt'
>;

interface BackoffOptions {
  attempt: number;
  maxRetries: number;
  error: ScrapeError;
  retryAfter: number | null;
}

export class Pacer {
  private readonly options: PacerOptions;
  private lastRequestAt: number | null;

  constructor(options: PacerOptions) {
    this.options = options;
    this.lastRequestAt = options.lastRequestAt ?? null;
  }

  checkDeadline(extraMs = 0) {
    const { deadlineAt, now } = this.options;

    if (deadlineAt !== null && now() + extraMs >= deadlineAt) {
      throw new DeadlineError('Run deadline reached');
    }
  }

  markRequest() {
    this.lastRequestAt = this.options.now();

    return this.lastRequestAt;
  }

  async wait(ms: number, reason: string) {
    if (ms <= 0) {
      return;
    }

    this.checkDeadline(ms);
    this.options.logger.debug('wait', { reason, ms: Math.round(ms) });
    await this.options.sleep(ms);
  }

  async throttle() {
    const { settings, now, random } = this.options;

    if (this.lastRequestAt === null) {
      return;
    }

    const spacing =
      settings.minRequestIntervalMs + random() * settings.requestJitterMs;

    await this.wait(this.lastRequestAt + spacing - now(), 'throttle');
  }

  async backoff({ attempt, maxRetries, error, retryAfter }: BackoffOptions) {
    if (attempt > maxRetries) {
      return;
    }

    const delay = Math.max(
      this.options.settings.backoffBaseMs * 2 ** (attempt - 1),
      retryAfter ?? 0,
    );

    this.options.logger.debug('retry', {
      attempt,
      of: maxRetries,
      reason: error.message,
      delayMs: Math.round(delay),
    });
    await this.wait(delay, 'backoff');
  }
}
