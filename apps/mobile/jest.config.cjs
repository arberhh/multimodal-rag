module.exports = {
  preset: "@react-native/jest-preset",
  testMatch: ["<rootDir>/__tests__/**/*.test.tsx"],
  moduleNameMapper: { "^~/(.*)$": "<rootDir>/$1" },
  transform: {
    "\\.[jt]sx?$": ["babel-jest", { presets: ["@react-native/babel-preset"] }],
  },
};
