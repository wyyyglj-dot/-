/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--primary)',
        'bg-base': 'var(--bg-base)',
        'bg-surface': 'var(--bg-surface)',
        'bg-card': 'var(--bg-card)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        'border-glass': 'var(--glass-border-l2)',
        'action-bg': 'var(--action-bg)',
        'action-bg-hover': 'var(--action-bg-hover)',
        'action-border': 'var(--action-border)',
        'surface-soft': 'rgb(var(--surface-soft-rgb) / <alpha-value>)',
        'table-idle': 'var(--status-idle-bg)',
        'table-dining': 'var(--status-dining-bg)',
        'table-checkout': 'var(--status-checkout-bg)',
      },
      boxShadow: {
        'card': 'var(--card-shadow)',
        'card-hover': 'var(--card-shadow-hover)',
      },
    },
  },
  plugins: [],
}
