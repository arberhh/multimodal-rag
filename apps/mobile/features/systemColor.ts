import type { ColorValue } from "react-native";

// Web: react-native-web has no PlatformColor, so importing it there breaks the page. The native
// version is systemColor.native.ts
export const systemColor = (_name: string, light: string): ColorValue => light;
