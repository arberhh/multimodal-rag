import { Platform } from "react-native";

// The Android emulator reaches the host machine at 10.0.2.2, not localhost.
// On a physical phone, set VITE_SERVER_URL to your machine's LAN address.
const defaultServerUrl = Platform.select({
  android: "http://10.0.2.2:3000",
  default: "http://localhost:3000",
});

export const serverUrl: string = import.meta.env.VITE_SERVER_URL || defaultServerUrl;
