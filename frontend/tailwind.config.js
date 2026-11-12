/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'mayra-blue': '#1E80C1',
        'mayra-navy': '#1E2A3C',
        'mayra-bg-from': '#EEF3FA',
        'mayra-bg-to': '#E2EAF6',
        'semaforo-verde': '#10B981',
        'semaforo-amarillo': '#F59E0B',
        'semaforo-rojo': '#EF4444',
      },
    },
  },
  plugins: [],
};

