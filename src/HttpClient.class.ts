import { attemptLoop } from '@mannerly/attempts';
import { checkPageBody, parseJsonBody } from '@mannerly/body-checks';
import { checkResponse } from '@mannerly/check-response';
import { resolveOptions } from '@mannerly/defaults';
import { EmptyPageError } from '@mannerly/errors';
import { Pacer } from '@mannerly/pacer';
import { Transport } from '@mannerly/transport';
import {
  type ClientConfig,
  GET,
  type GetOptions,
  type HttpClientOptions,
  type JsonOptions,
  type JsonResponse,
  type PageResponse,
  type RawResponse,
  type RequestSpec,
  type Verdict,
} from '@mannerly/types';

export type {
  FetchLike,
  GetOptions,
  HttpClientOptions,
  HttpSettings,
  JsonOptions,
  JsonResponse,
  LogFields,
  MannerlyLogger,
  PageResponse,
  SiteHttpOptions,
} from '@mannerly/types';

export class HttpClient {
  private readonly options: ClientConfig;
  private readonly pacer: Pacer;
  private readonly transport: Transport;
  warmUps = 0;

  constructor(clientOptions: HttpClientOptions = {}) {
    const options = resolveOptions(clientOptions);

    this.options = options;
    this.pacer = new Pacer(options);
    this.transport = new Transport({ options, pacer: this.pacer });
  }

  private get logger() {
    return this.options.logger;
  }

  get requestCount() {
    return this.transport.requestCount;
  }

  resetSession() {
    this.transport.jar.clear();
  }

  private attempt<T>({
    url,
    spec,
    maxRetries,
    validate,
  }: {
    url: string;
    spec: RequestSpec;
    maxRetries: number;
    validate: (response: RawResponse) => Verdict<T>;
  }) {
    return attemptLoop({
      url,
      maxRetries,
      validate,
      pacer: this.pacer,
      send: () => this.transport.send(url, spec),
    });
  }

  private handleEmpty({
    response,
    url,
    maxRetries,
  }: {
    response: RawResponse;
    url: string;
    maxRetries: number;
  }): Verdict<RawResponse> {
    if (!response.sentCookies && this.warmUps <= maxRetries) {
      this.warmUps++;
      this.logger.debug('session warm-up', {
        cookies: this.transport.jar.names,
      });

      return { again: true };
    }

    this.logger.debug('empty body with a session; resetting it');
    this.resetSession();

    return {
      error: new EmptyPageError(
        `Empty page even after a fresh session: ${url}`,
        response.status,
      ),
    };
  }

  private validatePage({
    response,
    url,
    requestedPath,
    maxRetries,
    marker,
  }: {
    response: RawResponse;
    url: string;
    requestedPath: string;
    maxRetries: number;
    marker: string | undefined;
  }): Verdict<RawResponse> {
    const { settings } = this.options;
    const { body } = response;
    const retry = checkResponse({
      options: this.options,
      url,
      requestedPath,
      response,
    });

    if (retry) {
      return retry;
    }

    if (body.trim() === '') {
      return this.handleEmpty({ response, url, maxRetries });
    }

    return marker === undefined
      ? { value: response }
      : checkPageBody({
          logger: this.logger,
          previewChars: settings.logBodyPreviewChars,
          url,
          response,
          marker,
        });
  }

  async get(url: string, options: GetOptions = {}): Promise<PageResponse> {
    const { settings, now } = this.options;
    const maxRetries = options.maxRetries ?? settings.maxRetries;
    const requestedPath = new URL(url).pathname;
    const started = now();

    const { value, attempts } = await this.attempt<RawResponse>({
      url,
      spec: GET,
      maxRetries,
      validate: (response) =>
        this.validatePage({
          response,
          url,
          requestedPath,
          maxRetries,
          marker: options.marker,
        }),
    });

    return {
      url,
      finalUrl: value.finalUrl,
      status: value.status,
      body: value.body,
      bytes: value.bytes,
      durationMs: now() - started,
      attempts,
    };
  }

  async json(url: string, options: JsonOptions = {}): Promise<JsonResponse> {
    const { settings, now } = this.options;
    const maxRetries = options.maxRetries ?? settings.maxRetries;
    const spec: RequestSpec = {
      method: options.method ?? 'GET',
      headers: options.headers ?? {},
      body: options.body,
    };
    const requestedPath = new URL(url).pathname;
    const started = now();

    const { value, attempts } = await this.attempt<{
      response: RawResponse;
      data: unknown;
    }>({
      url,
      spec,
      maxRetries,
      validate: (response) => {
        const retry = checkResponse({
          options: this.options,
          url,
          requestedPath,
          response,
        });

        if (retry) {
          return {
            error: retry.error.withBody(response.body),
            retryAfter: retry.retryAfter,
          };
        }

        return parseJsonBody({
          logger: this.logger,
          previewChars: settings.logBodyPreviewChars,
          url,
          response,
        });
      },
    });

    return {
      url,
      status: value.response.status,
      data: value.data,
      bytes: value.response.bytes,
      durationMs: now() - started,
      attempts,
    };
  }
}
