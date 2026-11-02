import { StyleSheet } from "react-native";

export const colors = {
  background: "#fff",
  border: "#e4e4e7",
  buttonBackground: "#18181b",
  buttonText: "#fff",
  connected: "#22c55e",
  muted: "#71717a",
  pending: "#a1a1aa",
  unreachable: "#ef4444",
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
  title: { fontSize: 28, fontWeight: "700" },
});
