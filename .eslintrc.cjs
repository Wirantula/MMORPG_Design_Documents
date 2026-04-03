module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  ignorePatterns: ['**/*.d.ts'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', {
      varsIgnorePattern: '^_',
      argsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    }],
  },
  env: {
    es2023: true,
    node: true,
  },
  overrides: [
    {
      files: ['client/src/**/*.{ts,tsx}'],
      env: {
        browser: true,
        node: false,
      },
    },
  ],
};
