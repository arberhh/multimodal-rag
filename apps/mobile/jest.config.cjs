module.exports = {
  preset: "@react-native/jest-preset",
  // the first test in a file includes compiling React Native, which is slow on a cold CI runner
  testTimeout: 30000,
  cacheDirectory: "<rootDir>/.jest-cache",
  testMatch: ["<rootDir>/__tests__/**/*.test.tsx"],
  moduleNameMapper: { "^~/(.*)$": "<rootDir>/$1" },
  transform: {
    "\\.[jt]sx?$": ["babel-jest", { presets: ["@react-native/babel-preset"] }],
  },
};
