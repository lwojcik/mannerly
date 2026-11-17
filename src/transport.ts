import { LOGGED_HEADERS, REDIRECT_STATUSES } from '@mannerly/constants';
import { CookieJar } from '@mannerly/cookies';
import { FetchError } from '@mannerly/errors';
import type { Pacer } from '@mannerly/pacer';
import {
  type ClientConfig,
  GET,
  type RawResponse,
  type RequestSpec,
} from '@mannerly/types';

export class Transport {
  readonly jar = new CookieJar();
  requestCount = 0;
  private readonly options: ClientConfig;
  private readonly pacer: Pacer;

  constructor({ options, pacer }: { options: ClientConfig; pacer: Pacer }) {
    this.options = options;
    this.pacer = pacer;
  }

  private get logger() {
    return this.options.logger;
  }

  async fetchHop(url: string, spec: RequestSpec) {
    this.pacer.checkDeadline();
    await this.pacer.throttle();
    const startedAt = this.pacer.markRequest();

    this.options.onRequest?.(startedAt);
    this.requestCount++;
    const headers: Record<string, string> = {
      ...this.options.headers,
      ...spec.headers,
    };

    if (!this.jar.isEmpty) {
      headers.Cookie = this.jar.header();
    }

    this.logger.debug('request', {
      method: spec.method,
      url,
      cookies: this.jar.names,
    });
    const response = await this.options.fetch(url, {
      method: spec.method,
      headers,
      body: spec.body,
      redirect: 'manual',
      signal: AbortSignal.timeout(this.options.settings.requestTimeoutMs),
    });
    const cookieNames = this.jar.store(response.headers, (value) =>
      this.logger.addSecret(value),
    );

    return { response, cookieNames };
  }

  async readAnswer({
    response,
    finalUrl,
    cookieNames,
    sentCookies,
  }: {
    response: Response;
    finalUrl: string;
    cookieNames: string[];
    sentCookies: boolean;
  }): Promise<RawResponse> {
    const buffer = await response.arrayBuffer();
    const body = new TextDecoder('utf-8').decode(buffer);
    const selected = Object.fromEntries(
      LOGGED_HEADERS.map((name) => [
        name,
        response.headers.get(name) ?? undefined,
      ]),
    );

    this.logger.debug('response', {
      status: response.status,
      finalUrl,
      bytes: buffer.byteLength,
      ...selected,
      setCookie: cookieNames.join(',') || undefined,
    });

    return {
      status: response.status,
      headers: response.headers,
      body,
      bytes: buffer.byteLength,
      finalUrl,
      sentCookies,
    };
  }

  async send(url: string, spec: RequestSpec = GET): Promise<RawResponse> {
    const { maxRedirects } = this.options.settings;
    // eslint-disable-next-line no-restricted-syntax -- carried across the redirect hops of the loop below
    let current = url;
    const isSentCookies = !this.jar.isEmpty;

    // eslint-disable-next-line no-restricted-syntax -- sequential on purpose: one request per hop, in order
    for (let hop = 0; ; hop++) {
      const { response, cookieNames } = await this.fetchHop(current, spec);
      const location = response.headers.get('location');

      if (!(REDIRECT_STATUSES.has(response.status) && location)) {
        return this.readAnswer({
          response,
          finalUrl: current,
          cookieNames,
          sentCookies: isSentCookies,
        });
      }

      if (hop >= maxRedirects) {
        throw new FetchError(`Too many redirects from ${url}`, response.status);
      }

      const next = new URL(location, current).href;

      this.logger.debug('redirect', {
        status: response.status,
        from: current,
        to: next,
        setCookie: cookieNames.join(',') || undefined,
      });
      current = next;
    }
  }
}
