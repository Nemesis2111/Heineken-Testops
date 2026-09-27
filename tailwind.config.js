/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ibmblue: { DEFAULT: "#0F62FE", dark: "#0043CE", soft: "#E8F0FF" },
        heingreen: { DEFAULT: "#00873D", dark: "#006429", soft: "#E4F6EC" },
        danger: { DEFAULT: "#DA1E28", soft: "#FFEAEA" },
        warn: { DEFAULT: "#FF832B", soft: "#FFF1E5" },
        ink: "#0B1A33",
        slateink: "#5B6B85",
        faint: "#8895AB",
      },
      fontFamily: {
        display: ["Sora", "ui-sans-serif", "system-ui"],
        body: ["Inter", "ui-sans-serif", "system-ui"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      keyframes: {
        scan: { "0%": { left: "-40%" }, "100%": { left: "100%" } },
        pulseRing: { "0%": { transform: "scale(0.6)", opacity: "0.5" }, "100%": { transform: "scale(2.2)", opacity: "0" } },
        floatBlob: { "0%,100%": { transform: "translate(0,0) scale(1)" }, "50%": { transform: "translate(10px,-14px) scale(1.05)" } },
      },
      animation: {
        scan: "scan 3.2s linear infinite",
        pulseRing: "pulseRing 1.8s ease-out infinite",
        floatBlob: "floatBlob 10s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
