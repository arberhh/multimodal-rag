import { One, type SFSymbolName } from "one";
import { type ColorValue, StyleSheet, Text } from "react-native";

type Props = {
  name: SFSymbolName; // the SF Symbol, on iOS
  fallback: string; // a character that stands in for it elsewhere
  size: number;
  color: ColorValue;
};

// An SF Symbol on iOS, drawn by SwiftUI. Android and web show the fallback character
export function SystemIcon({ name, fallback, size, color }: Props) {
  if (One.platform === "ios") {
    // the same box for React Native and SwiftUI: SwiftUI centers the symbol in its frame, and
    // without one draws it at its own size in the box's top corner
    const box = size * 1.4;
    return (
      <One.iOS.Image
        systemName={name}
        style={{ width: box, height: box }}
        // decoration: the button around it carries the label
        swiftStyle={{
          ...swiftStyles.icon,
          width: box,
          height: box,
          fontSize: size,
          foregroundStyle: color,
        }}
      />
    );
  }
  return (
    <Text style={[styles.fallback, { color, fontSize: size }]} accessibilityElementsHidden>
      {fallback}
    </Text>
  );
}

const swiftStyles = {
  icon: { fontWeight: "semibold", accessibilityHiddenWithBool: true },
} as const;

const styles = StyleSheet.create({
  fallback: { fontWeight: "600" },
});
