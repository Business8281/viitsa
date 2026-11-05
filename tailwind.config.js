/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand
        brandBlue: {
          DEFAULT: '#106EBE',
          50: '#F0F7FD',
          100: '#E1EFFB',
          200: '#C2DEF7',
          300: '#94C5F1',
          400: '#5FA6E8',
          500: '#106EBE',
          600: '#0E5EA2',
          700: '#0B4D86',
          800: '#093E6C',
          900: '#072E51',
        },
        brandMint: {
          DEFAULT: '#0FFCBE',
          50: '#F0FEFA',
          100: '#D6FCF2',
          200: '#A4FCE6',
          300: '#69FBD6',
          400: '#34FBC7',
          500: '#0FFCBE',
          600: '#00D49C',
          700: '#00A678',
          800: '#007856',
          900: '#004A35',
        },
        primary: {
          DEFAULT: '#0F6E56',
          50: '#E1F5EE',
          100: '#C7ECDC',
          200: '#9BDBBE',
          300: '#6ACA9F',
          400: '#3EB980',
          500: '#0F6E56',
          600: '#0C5A47',
          700: '#094638',
          800: '#063229',
          900: '#031E18',
        },
        accent: {
          DEFAULT: '#05C994',
          50: '#E0FBF4',
          100: '#B8F4E5',
          200: '#7EE9CD',
          300: '#45DDB5',
          400: '#1FD4A4',
          500: '#05C994',
          600: '#04A67B',
          700: '#038262',
          800: '#025F48',
          900: '#013C2E',
        },
        // Surfaces & text — flat keys so each utility is unambiguous
        surface: '#F5FAFA',
        'surface-card': '#FFFFFF',

        // Text ink scale
        ink: {
          DEFAULT: '#0F1B2C',
          muted: '#5A6B7B',
          subtle: '#8A99A8',
        },

        // Status colors — flat keys + nested objects
        warning: {
          DEFAULT: '#E08600',
          bg: '#FEF3E2',
          50: '#FEF3E2',
          100: '#FDE6C0',
          500: '#E08600',
          600: '#B86F00',
          700: '#8C5500',
        },
        danger: {
          DEFAULT: '#D63B4B',
          bg: '#FCE7EA',
          50: '#FCE7EA',
          100: '#F9C7CD',
          500: '#D63B4B',
          600: '#B82F3E',
          700: '#8F2530',
        },
        success: {
          DEFAULT: '#0F6E56',
          bg: '#E1F5EE',
          50: '#E1F5EE',
          100: '#C7ECDC',
          500: '#0F6E56',
          600: '#0C5A47',
          700: '#094638',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Arial', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(15,27,44,0.06), 0 1px 2px rgba(15,27,44,0.04)',
        'card-hover': '0 8px 24px rgba(15,27,44,0.08), 0 2px 6px rgba(15,27,44,0.04)',
        ring: '0 0 0 3px rgba(15,110,86,0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
};
