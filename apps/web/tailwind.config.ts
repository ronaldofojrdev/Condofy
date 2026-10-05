import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef8f2",
          100: "#d7ecdf",
          200: "#b0d9bf",
          300: "#85c39b",
          400: "#5dae7a",
          500: "#3e955f",
          600: "#2f774b",
          700: "#245f3d",
          800: "#1d4c31",
          900: "#163f29"
        }
      }
    }
  },
  plugins: []
};

export default config;
