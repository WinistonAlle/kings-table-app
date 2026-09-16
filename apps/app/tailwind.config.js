/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Backgrounds — warm near-black
        'kt-bg-0': '#0a0807',
        'kt-bg-1': '#11100e',
        'kt-bg-2': '#1a1816',
        'kt-bg-3': '#242220',
        'kt-bg-4': '#2e2b28',
        // Text
        'kt-text-0': '#f5ede0',
        'kt-text-1': '#c9bda6',
        'kt-text-2': '#7a7366',
        'kt-text-3': '#4a463f',
        // Gold — champagne family
        'kt-gold-50':  '#f6ead0',
        'kt-gold-100': '#ecd9a5',
        'kt-gold-200': '#e8d5a0',
        'kt-gold-300': '#d4bc7e',
        'kt-gold-400': '#b89a5e',
        'kt-gold-500': '#8a723f',
        'kt-gold-600': '#5a4a28',
        'kt-gold-700': '#352c18',
        'kt-gold-800': '#1e1a10',
        // Accent
        'kt-accent':     '#3d8a6a',
        'kt-accent-dim': '#1f4a38',
        // Suit
        'kt-red':   '#c85a5a',
        // Status
        'kt-ok':    '#78a885',
        'kt-warn':  '#d9a74a',
        'kt-danger':'#c85a5a',
      },
      fontFamily: {
        display: ['CormorantGaramond_500Medium'],
        'display-italic': ['CormorantGaramond_500Medium_Italic'],
        ui: ['InterTight_400Regular'],
        'ui-medium': ['InterTight_500Medium'],
        'ui-semibold': ['InterTight_600SemiBold'],
        'ui-bold': ['InterTight_700Bold'],
        mono: ['JetBrainsMono_400Regular'],
        'mono-medium': ['JetBrainsMono_500Medium'],
        'mono-bold': ['JetBrainsMono_700Bold'],
      },
    },
  },
  plugins: [],
};
