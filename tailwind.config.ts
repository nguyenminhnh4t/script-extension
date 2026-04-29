import type { Config } from 'tailwindcss';

export default {
  content: ['./popup.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
