/** @type {import('tailwindcss').Config} */
export default {
	darkMode: ['class'],
	content: [
		'./pages/**/*.{ts,tsx}',
		'./components/**/*.{ts,tsx}',
		'./app/**/*.{ts,tsx}',
		'./src/**/*.{ts,tsx}',
	],
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px',
			},
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				// الألوان الرئيسية - سماوي وأزرق فاتح (مضافة)
				'gov-dark': '#0891b2',
				'gov-navy': '#0e7490',
				'gov-blue': '#06b6d4',
				'gov-gold': '#06b6d4',
				'gov-gold-light': '#67e8f9',
				'gov-cyan': '#22d3ee',
				'gov-light': '#0f172a',
				'gov-muted': '#475569',
				// ألوان الخلفية
				'bg-cyan-50': '#ecfeff',
				'bg-cyan-100': '#cffafe',
				// ألوان النص
				'text-dark': '#0f172a',
				'text-gray': '#475569',
				// ألوان الحالة
				'success': '#10b981',
				'error': '#ef4444',
				'warning': '#f59e0b',
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
				// نصف القطر المخصص
				'radius-sm': '8px',
				'radius-md': '12px',
				'radius-lg': '16px',
				'radius-xl': '24px',
			},
			fontFamily: {
				'tajawal': ['Tajawal', 'sans-serif'],
			},
			boxShadow: {
				'gold': '0 0 40px rgba(6, 182, 212, 0.3)',
				'blue': '0 0 40px rgba(6, 182, 212, 0.2)',
				'card': '0 8px 32px rgba(6, 182, 212, 0.1)',
				'card-hover': '0 20px 60px rgba(6, 182, 212, 0.15)',
				'glass': '0 8px 32px rgba(6, 182, 212, 0.1), 0 0 40px rgba(6, 182, 212, 0.2)',
			},
			keyframes: {
				'accordion-down': {
					from: { height: 0 },
					to: { height: 'var(--radix-accordion-content-height)' },
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: 0 },
				},
				'float': {
					'0%, 100%': 'transform: translateY(0) rotate(0deg)',
					'50%': 'transform: translateY(-30px) rotate(5deg)',
				},
				'pulse-slow': {
					'0%, 100%': 'transform: scale(1); opacity: 0.5',
					'50%': 'transform: scale(1.05); opacity: 0.8',
				},
				'grid-move': {
					'0%': 'transform: translate(0, 0)',
					'100%': 'transform: translate(50px, 50px)',
				},
				'dots-float': {
					'0%, 100%': 'opacity: 0.3',
					'50%': 'opacity: 0.6',
				},
				'pattern-move': {
					'0%': 'transform: translate(0, 0)',
					'100%': 'transform: translate(40px, 40px)',
				},
				'logo-float': {
					'0%, 100%': 'transform: translateY(0)',
					'50%': 'transform: translateY(-15px)',
				},
				'slide-down': {
					from: { opacity: '0', transform: 'translateY(-20px)' },
					to: { opacity: '1', transform: 'translateY(0)' },
				},
				'loading': {
					'0%': 'background-position: 200% 0',
					'100%': 'background-position: -200% 0',
				},
				'glow-pulse': {
					'0%, 100%': { opacity: '0.6', transform: 'translate(-50%, -50%) scale(1)' },
					'50%': { opacity: '1', transform: 'translate(-50%, -50%) scale(1.15)' },
				},
				'spin': {
					to: { transform: 'rotate(360deg)' },
				},
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'float': 'float 15s infinite ease-in-out',
				'pulse-slow': 'pulse-slow 4s infinite ease-in-out',
				'grid-move': 'grid-move 20s linear infinite',
				'dots-float': 'dots-float 10s infinite ease-in-out',
				'pattern-move': 'pattern-move 30s linear infinite',
				'logo-float': 'logo-float 6s ease-in-out infinite',
				'slide-down': 'slide-down 0.4s ease',
				'loading': 'loading 1.5s infinite',
				'glow-pulse': 'glow-pulse 2s infinite ease-in-out',
				'spin': 'spin 1s linear infinite',
			},
			transitionTimingFunction: {
				'slow': 'cubic-bezier(0.4, 0, 0.2, 1)',
			},
		},
	},
	plugins: [require('tailwindcss-animate')],
}
