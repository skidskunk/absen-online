/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: "#0b1220",
        darkCard: "#0f1b33",
        darkMuted: "#9fb0d0",
        darkText: "#eaf0ff",
        primaryBlue: "#4f8cff",
        accentDanger: "#ff4f5e",
        accentWarning: "#ffb020",
        accentSuccess: "#2ee59d",
        accentInfo: "#33c6ff",
      },
      borderRadius: {
        custom: "18px",
      },
      boxShadow: {
        glow: "0 12px 35px rgba(0,0,0,0.35)",
        deep: "0 20px 50px rgba(0,0,0,0.45)",
      },
    },
  },
  plugins: [],
};
