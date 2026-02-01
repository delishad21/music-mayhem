import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'lavender-veil': '#e5d4ed',
        'medium-slate-blue': '#6d72c3',
        'rebecca-purple': '#5941a9',
        'charcoal': '#514f59',
        'midnight-violet': '#1d1128',
      },
    },
  },
  plugins: [],
};
export default config;
