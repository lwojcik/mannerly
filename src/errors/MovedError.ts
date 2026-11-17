import { ScrapeError } from '@mannerly/errors/ScrapeError';

export class MovedError extends ScrapeError {
  newPath: string;

  constructor(newPath: string, status: number | null = null) {
    super(`Moved to ${newPath}`, status);
    this.newPath = newPath;
  }
}
