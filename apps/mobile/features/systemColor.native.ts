import { type ColorValue, Platform, PlatformColor } from "react-native";

// An iOS system color, which follows light and dark mode. Android gets the light color for now
export const systemColor = (name: string, light: string): ColorValue =>
  Platform.OS === "ios" ? PlatformColor(name) : light;
