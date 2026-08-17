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
  },

  {
    /**
     * The design system, enforced rather than remembered.
     *
     * Surfaces, radii, shadows and text colours belong to tokens in
     * tailwind.config.js and to the primitives in src/ui. Writing them by hand
     * is how the same card ended up hand-styled in 42 files across 7 corner
     * radii - the drift that showed up every time anything was touched.
     *
     * Scoped to the portfolio components, which are migrated. Widen the files
     * list as other areas move over; src/ui is exempt because it defines them.
     */
    files: ['frontend/src/components/Portfolio/**/*.jsx'],
    rules: {
      'no-restricted-syntax': ['error', {
        // A hover: prefix is an interaction state, not a surface, so it is exempt.
        selector: 'Literal[value=/(?<!hover:)\\b(bg-white|bg-gray-800|rounded-xl|rounded-2xl|shadow-sm|shadow-md|shadow-lg|shadow-xl)\\b/]',
        message: 'Use a design token or a primitive from src/ui - bg-surface, rounded-card, shadow-card. Raw surface classes drift.'
      }]
    }
  }
];