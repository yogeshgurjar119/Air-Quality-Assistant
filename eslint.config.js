import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'coverage/', '.vercel/', '.netlify/'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2023, sourceType: 'module' },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['log', 'warn', 'error'] }],
      curly: ['error', 'multi-line'],
    },
  },
  {
    files: ['server/**/*.js', 'api/**/*.js', 'netlify/**/*.js', 'tests/**/*.js', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
  { files: ['public/**/*.js'], languageOptions: { globals: globals.browser } },
  {
    // Maintainability limits for application code. Tests are exempt: describe blocks are long by nature.
    files: ['server/**/*.js', 'public/**/*.js', 'api/**/*.js', 'netlify/**/*.js'],
    rules: {
      complexity: ['error', 8],
      'max-depth': ['error', 3],
      'max-params': ['error', 4],
      'max-statements': ['error', 20],
      'max-nested-callbacks': ['error', 3],
      'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 40, skipBlankLines: true, skipComments: true }],
      'no-nested-ternary': 'error',
      'no-else-return': 'error',
      'no-shadow': 'error',
      'no-await-in-loop': 'error',
      'no-param-reassign': ['error', { props: false }],
      'require-await': 'error',
      'no-magic-numbers': [
        'error',
        {
          ignore: [0, 1, -1, 2, 10, 100, 1000],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
          enforceConst: true,
        },
      ],
    },
  },
  {
    // Pure presentation tuning (colours, particle counts, easing); naming each value would not help a reader.
    files: ['public/airfx.js', 'public/gauge.js'],
    rules: { 'no-magic-numbers': 'off' },
  },
  {
    // DOM tests run browser code under jsdom, so they see both Node and browser globals.
    files: [
      'tests/ui-*.test.js',
      'tests/api-client.test.js',
      'tests/helpers-dom.js',
      'tests/e2e.test.js',
      'tests/helpers-browser.js',
    ],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
