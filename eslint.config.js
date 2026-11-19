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
    // DOM tests run browser code under jsdom, so they see both Node and browser globals.
    files: ['tests/ui-*.test.js', 'tests/api-client.test.js', 'tests/helpers-dom.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
