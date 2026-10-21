const tsParser = require("@typescript-eslint/parser");
const reactNative = require("eslint-plugin-react-native");

module.exports = [
  {
    files: ["apps/mobile/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "react-native": reactNative,
    },
    rules: {
      "react-native/no-color-literals": "error",
      "react-native/no-inline-styles": "error",
      "react-native/no-raw-text": "error",
      "react-native/no-single-element-style-arrays": "error",
      "react-native/no-unused-styles": "error",
      "react-native/sort-styles": "error",
      "react-native/split-platform-components": "error",
    },
  },
  {
    // <title> in the web <head> is HTML, not React Native text
    files: ["apps/mobile/app/_layout.tsx"],
    rules: { "react-native/no-raw-text": "off" },
  },
  {
    ignores: ["**/dist/*", "**/android/*", "**/ios/*", "**/.one/*"],
  },
];
