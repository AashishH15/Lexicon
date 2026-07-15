/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F7F6F3",
        ink: "#111111",
        muted: "#787774",
        hairline: "#EAEAEA",
        "pale-red": "#FDEBEC",
        "pale-red-text": "#9F2F2D",
        "pale-blue": "#E1F3FE",
        "pale-blue-text": "#1F6C9F",
        "pale-green": "#EDF3EC",
        "pale-green-text": "#346538",
        "pale-yellow": "#FBF3DB",
        "pale-yellow-text": "#956400",
      },
      fontFamily: {
        serif: ['"Newsreader"', "Georgia", "serif"],
        sans: [
          '"Geist Sans"',
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
