/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                background: '#0B0B0C',
                foreground: '#F3F3F3',
                surface: '#141418',
                border: '#232327',
                primary: {
                    DEFAULT: '#22C55E',
                    foreground: '#000000',
                },
                secondary: {
                    DEFAULT: '#1a1a1e',
                    foreground: '#A0A0A8',
                },
                muted: {
                    DEFAULT: '#141418',
                    foreground: '#A0A0A8',
                },
                accent: {
                    DEFAULT: '#22C55E',
                    foreground: '#000000',
                },
                success: '#22C55E',
                destructive: '#EF4444',
                warning: '#F59E0B',
            },
            fontFamily: {
                sans: ['var(--font-sans)'],
                serif: ['var(--font-serif)'],
            },
        },
    },
    plugins: [],
}
