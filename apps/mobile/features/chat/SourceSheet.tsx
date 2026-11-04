import { One, useSafeAreaInsets } from "one";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Source } from "@multimodal-rag/shared";
import { colors } from "~/features/theme";
import { Markdown } from "./Markdown";

type SourceSheetProps = {
  // the source shown; it stays set while the sheet slides away
  source: Source | null;
  open: boolean;
  close: () => void;
};

// what the answer used from the page: its paragraphs, tables and figures, drawn like an answer
function SourceContent({ source, close }: { source: Source; close?: () => void }) {
  const { bottom } = useSafeAreaInsets();
  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + 24 }]}>
      <View style={styles.header}>
        <View style={styles.titles}>
          <Text style={styles.title} numberOfLines={2}>
            {source.fileName}
          </Text>
          <Text style={styles.page}>Page {source.page}</Text>
        </View>
        {close && (
          <Pressable onPress={close} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.done}>Done</Text>
          </Pressable>
        )}
      </View>
      {source.quote ? (
        <Markdown>{source.quote}</Markdown>
      ) : (
        <Text style={styles.missing}>
          This answer was saved before the app kept the part of the page it used.
        </Text>
      )}
    </ScrollView>
  );
}

// iOS: SwiftUI's sheet, half height first, with the grabber to drag it to full height
function SourceSheetIOS({ source, open, close }: SourceSheetProps) {
  return (
    <One.iOS.Sheet
      isPresented={open}
      onIsPresentedChange={(presented) => !presented && close()}
      presentationDetents={["medium", "large"]}
      presentationDragIndicator="visible"
    >
      {source && <SourceContent source={source} />}
    </One.iOS.Sheet>
  );
}

// Android (a native dialog) and web: React Native's modal, with Done to close it
function SourceSheetModal({ source, open, close }: SourceSheetProps) {
  return (
    <Modal visible={open} onRequestClose={close} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <Pressable style={styles.scrim} onPress={close} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          {source && <SourceContent source={source} close={close} />}
        </View>
      </View>
    </Modal>
  );
}

// SwiftUI views throw on the wrong platform, so pick one per platform
const sheets = { ios: SourceSheetIOS, android: SourceSheetModal, web: SourceSheetModal };
export const SourceSheet = sheets[One.platform];

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end" },
  content: { gap: 12, padding: 20 },
  done: { color: colors.accent, fontSize: 16, fontWeight: "600" },
  header: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  missing: { color: colors.muted, fontSize: 15 },
  page: { color: colors.muted, fontSize: 14 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim },
  sheet: {
    alignSelf: "center",
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "75%",
    maxWidth: 640,
    width: "100%",
  },
  title: { color: colors.text, fontSize: 17, fontWeight: "600" },
  titles: { flex: 1, gap: 2 },
});
