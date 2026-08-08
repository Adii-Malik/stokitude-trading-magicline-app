import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';

/**
 * Lint config focused on the bug class that has actually bitten this project:
 * references to variables that were never defined or imported. Those only
 * surface at runtime, and code paths that never ran hid several of them.
 */
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      'frontend/public/**'
    ]
  },

  // ---- Backend: Node, ESM ----
  {
    files: ['backend/src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node }
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-undef': 'error',
      'no-unused-vars': ['warn', {
        args: 'none',
        varsIgnorePattern: '^_',
        caughtErrors: 'none'
      }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-constant-condition': ['warn', { checkLoops: false }]
    }
  },

  // ---- Frontend: browser, ESM, JSX ----
  {
    files: ['frontend/src/**/*.{js,jsx}'],
    plugins: { react },
    settings: { react: { version: 'detect' } },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true }
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      // Marks identifiers used inside JSX as "used" so no-unused-vars
      // does not flag every imported component.
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'error',
      'no-undef': 'error',
      'no-unused-vars': ['warn', {
        args: 'none',
        varsIgnorePattern: '^(_|React$)',
        caughtErrors: 'none'
      }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-constant-condition': ['warn', { checkLoops: false }]
    }
  }
];
