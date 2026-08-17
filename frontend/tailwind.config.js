/** @type {import('tailwindcss').Config} */

/**
 * Semantic tokens, so "what a card looks like" is decided here rather than
 * retyped in every component. Before this, the same card surface was written
 * out by hand in 42 files, across 7 corner radii and 5 shadow levels - which
 * is why the design drifted a little every time anything was touched.
 *
 * Components should reach for these, not for raw palette values. The lint
 * rule in eslint.config.js enforces that inside src/components/Portfolio.
 */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces a component sits on
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-muted': 'rgb(var(--surface-muted) / <alpha-value>)',
        // Hairlines and rings
        hairline: 'rgb(var(--hairline) / <alpha-value>)',
        // Text
        ink: 'rgb(var(--ink) / <alpha-value>)',
        'ink-muted': 'rgb(var(--ink-muted) / <alpha-value>)',
        'ink-faint': 'rgb(var(--ink-faint) / <alpha-value>)',
      },
      borderRadius: {
        card: '1rem',      // every panel, dialog and table container
        control: '0.5rem', // inputs, buttons, chips
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'card-hover': '0 4px 12px -2px rgb(0 0 0 / 0.08)',
        dialog: '0 20px 40px -12px rgb(0 0 0 / 0.25)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
      }
    },
  },
  plugins: [],
}
