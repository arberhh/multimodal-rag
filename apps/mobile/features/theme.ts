import { StyleSheet } from "react-native";
import { systemColor as system } from "./systemColor";

// iOS system colors follow light and dark mode. Android and web keep the light colors for now
export const colors = {
  accent: system("systemBlue", "#2563eb"),
  background: system("systemBackground", "#fff"),
  border: system("separator", "#e4e4e7"),
  buttonBackground: system("label", "#18181b"),
  buttonText: system("systemBackground", "#fff"),
  connected: system("systemGreen", "#22c55e"),
  faint: system("tertiaryLabel", "#a1a1aa"),
  // a light fill behind small things, like source pills and suggestions
  fill: system("tertiarySystemFill", "#f4f4f5"),
  muted: system("secondaryLabel", "#71717a"),
  onAccent: "#fff",
  pending: system("systemGray", "#a1a1aa"),
  // dims the screen behind a sheet
  scrim: "rgba(0, 0, 0, 0.3)",
  surface: system("secondarySystemBackground", "#f4f4f5"),
  text: system("label", "#18181b"),
  unreachable: system("systemRed", "#ef4444"),
};

export const sharedStyles = StyleSheet.create({
  button: {
    backgroundColor: colors.buttonBackground,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonText: { color: colors.buttonText, fontWeight: "600" },
  dot: { borderRadius: 5, height: 10, width: 10 },
  title: { color: colors.text, fontSize: 28, fontWeight: "700" },
});
