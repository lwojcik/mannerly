export class ScrapeError extends Error {
  status: number | null;
  body: string | null = null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = new.target.name;
    this.status = status;
  }

  withBody(body: string) {
    this.body = body;

    return this;
  }
}
