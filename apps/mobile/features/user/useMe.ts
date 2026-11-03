import { useEffect, useState } from "react";
import { Alert, Platform } from "react-native";
import { getMe, saveName } from "./api";

const title = "Your name";
const message = "So the app knows what to call you.";

// The user's name, once the server can be reached. rename asks for a new one: a native prompt on
// iOS and the browser's on web. Android has no text prompt, so there it's undefined
export function useMe(enabled: boolean) {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    const load = async () => {
      try {
        const me = await getMe();
        if (current) setName(me.name);
      } catch {
        // the name is a nicety: without it the screen just doesn't show one
      }
    };
    load();
    return () => {
      current = false;
    };
  }, [enabled]);

  const save = async (value: string | null | undefined) => {
    const next = value?.trim();
    if (!next) return;
    try {
      setName((await saveName(next)).name);
    } catch (err) {
      Alert.alert("Couldn't save your name", err instanceof Error ? err.message : undefined);
    }
  };

  const rename = () => {
    if (Platform.OS === "web") return save(window.prompt(title, name ?? ""));
    Alert.prompt(
      title,
      message,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Save", onPress: (value?: string) => save(value) },
      ],
      "plain-text",
      name ?? "",
    );
  };

  return { name, rename: Platform.OS === "android" ? undefined : rename };
}
