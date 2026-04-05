import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          900: '#0F1117',
          800: '#1A1D27',
          700: '#2A2D37',
          600: '#3A3D47',
        },
        agent: {
          director: '#6B8ABA',
          senior: '#D4915C',
          junior: '#D4A84C',
          procurement: '#7DA47B',
          admin: '#9B8EC4',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
