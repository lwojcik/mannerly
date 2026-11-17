import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS, SILENT_LOGGER } from '@mannerly/defaults';
import { HttpClient } from '@mannerly/HttpClient.class';

describe('a client with no options', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the global fetch, the real clock and a silent logger', async () => {
    const globalFetch = vi.fn(async () => new Response('{"ok":true}'));

    vi.stubGlobal('fetch', globalFetch);
    const http = new HttpClient();

    await expect(http.json('https://example.org/a')).resolves.toMatchObject({
      data: { ok: true },
      attempts: 1,
    });
    expect(http.requestCount).toBe(1);
    expect(globalFetch).toHaveBeenCalledOnce();
  });

  it('really sleeps between two requests', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('[]')),
    );
    const http = new HttpClient({
      settings: { minRequestIntervalMs: 20, requestJitterMs: 0 },
    });
    const started = Date.now();

    await http.json('https://example.org/a');
    await http.json('https://example.org/a');
    expect(Date.now() - started).toBeGreaterThanOrEqual(15);
  });

  it('merges partial settings over the defaults', () => {
    expect(DEFAULT_SETTINGS.maxRetries).toBe(3);
    expect(SILENT_LOGGER.debug('x')).toBeUndefined();
    expect(SILENT_LOGGER.warn('x')).toBeUndefined();
    expect(SILENT_LOGGER.addSecret('x')).toBeUndefined();
  });
});
