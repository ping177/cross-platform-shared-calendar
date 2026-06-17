import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#172026',
        mist: '#f5f7f8',
        coral: '#f9735b',
        teal: '#0f766e',
        amber: '#d97706',
      },
      boxShadow: {
        soft: '0 18px 48px rgba(23, 32, 38, 0.12)',
      },
    },
  },
  plugins: [],
} satisfies Config;
