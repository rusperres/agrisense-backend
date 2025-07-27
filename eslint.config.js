// eslint.config.cjs
const eslintPluginImport = require('eslint-plugin-import');
const eslintPluginTs = require('@typescript-eslint/eslint-plugin');
const parserTs = require('@typescript-eslint/parser');

/** @type {import("eslint").Linter.FlatConfig[]} */
module.exports = [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: parserTs,
      parserOptions: {
        project: ['./tsconfig.json'],
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': eslintPluginTs,
      import: eslintPluginImport,
    },
    rules: {
      semi: ['error', 'always'],
      quotes: ['error', 'single'],
      'no-unused-vars': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn'],
      'import/order': ['warn', { 'alphabetize': { order: 'asc' } }],
    },
  },
];
