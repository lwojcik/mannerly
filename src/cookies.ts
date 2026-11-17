export const parseSetCookies = (headers: Headers) =>
  headers
    .getSetCookie()
    .map((cookie) => cookie.split(';', 1)[0])
    .filter((pair) => pair.indexOf('=') > 0)
    .map((pair) => {
      const separator = pair.indexOf('=');

      return {
        name: pair.slice(0, separator).trim(),
        value: pair.slice(separator + 1).trim(),
      };
    });

export class CookieJar {
  private readonly cookies = new Map<string, string>();

  get isEmpty() {
    return this.cookies.size === 0;
  }

  get names() {
    return this.cookies.keys().toArray().join(',') || 'none';
  }

  store(headers: Headers, onValue: (value: string) => void) {
    return parseSetCookies(headers).map(({ name, value }) => {
      this.cookies.set(name, value);
      onValue(value);

      return name;
    });
  }

  header() {
    return [...this.cookies]
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  clear() {
    this.cookies.clear();
  }
}
