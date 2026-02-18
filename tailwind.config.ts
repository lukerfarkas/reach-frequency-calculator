import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        unlock: {
          red: "#db1217",
          "barn-red": "#740316",
          salmon: "#fac2b9",
          black: "#161616",
          ocean: "#217caa",
          sky: "#7dc8ef",
          ice: "#dff0f8",
          "dark-gray": "#494343",
          "medium-gray": "#7d7577",
          "light-gray": "#d0d0d2",
          alabaster: "#fcf0e6",
        },
      },
    },
  },
  plugins: [],
};
export default config;
