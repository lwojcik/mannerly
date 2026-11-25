import { createConfig } from '@lwojcik/eslint-config';

const config = createConfig({
  tsconfigRootDir: import.meta.dirname,
  importAliases: ['@mannerly'],
  ignores: ['coverage/', 'dist/'],
  untypedFiles: ['vitest.config.ts', 'tsdown.config.ts', 'eslint.config.js'],
  nodeVersion: '>=24.0.0',
});

export default [
  ...config,
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-comments/disallowComments': [
        'error',
        { allow: ['global', 'eslint', '\\*'] },
      ],
      'max-len': [
        'error',
        {
          code: 80,
          ignoreComments: true,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreRegExpLiterals: true,
          ignorePattern: '^\\s*(//|/\\*) eslint-',
        },
      ],
      'unicorn/no-asterisk-prefix-in-documentation-comments': 'off',
      'unicorn/single-line-block-comment-style': 'off',
    },
  },
];
