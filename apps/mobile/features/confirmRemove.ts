import { Alert, Platform } from "react-native";

// Asks before removing something. Alert does nothing on web, so the browser asks instead
export function confirmRemove(name: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm(`Remove ${name}?`)) onConfirm();
    return;
  }
  Alert.alert(`Remove ${name}?`, "This can't be undone.", [
    { text: "Cancel", style: "cancel" },
    { text: "Remove", style: "destructive", onPress: onConfirm },
  ]);
}
