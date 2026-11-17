import type { LogFields, MannerlyLogger } from '@mannerly/types';

export const captureLogger = (verbose: boolean) => {
  const lines: string[] = [];
  const secrets = new Set<string>();

  const write =
    (level: string) =>
    (message: string, fields: LogFields = {}) => {
      const text = [
        level,
        message,
        ...Object.entries(fields).map(([k, v]) => `${k}=${String(v)}`),
      ].join(' ');

      lines.push(
        secrets.size === 0
          ? text
          : [...secrets].reduce(
              (acc, secret) => acc.split(secret).join('<redacted>'),
              text,
            ),
      );
    };

  const logger: MannerlyLogger = {
    verbose,
    debug: write('DEBUG'),
    warn: write('WARN'),
    addSecret: (value) => {
      if (value) {
        secrets.add(value);
      }
    },
  };

  return { logger, lines };
};
