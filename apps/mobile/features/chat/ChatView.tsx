import { Link, useSafeAreaInsets } from "one";
import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  type HostInstance,
  Keyboard,
  KeyboardAvoidingView,
  type ListRenderItemInfo,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors, sharedStyles } from "~/features/theme";
import { Markdown } from "./Markdown";
import type { ChatViewProps, Turn } from "./useChat";

const emptyLabel = "Ask a question about your documents.";
const PAGE_PADDING = 16;

const sendLabel = (loading: boolean) => (loading ? "Answering…" : "Send");

// While the keyboard is open it already covers the bottom edge, so the safe area isn't needed there
function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", () =>
      setOpen(true),
    );
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () =>
      setOpen(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

// one view for every platform: unlike the documents list, a chat has nothing native to gain
export function ChatView({ turns, loading, error, send }: ChatViewProps) {
  const [draft, setDraft] = useState("");
  // how far down the window this screen starts (the header), which the keyboard must be offset by
  const [top, setTop] = useState(0);
  const root = useRef<HostInstance>(null);
  const list = useRef<FlatList<Turn>>(null);
  const keyboardOpen = useKeyboardOpen();
  const { bottom } = useSafeAreaInsets();

  const submit = () => {
    if (!draft.trim() || loading) return;
    send(draft);
    setDraft("");
  };

  const renderTurn = ({ item, index }: ListRenderItemInfo<Turn>) => (
    <View style={styles.turn}>
      <View style={styles.userBubble}>
        <Text style={styles.userText} selectable>
          {item.question}
        </Text>
      </View>
      <View style={styles.answer}>
        {item.answer ? <Markdown>{item.answer}</Markdown> : null}
        {!item.answer && loading && index === turns.length - 1 ? (
          <Text style={styles.muted}>Thinking…</Text>
        ) : null}
        {item.sources?.length ? (
          <View style={styles.sources}>
            <Text style={styles.muted}>Sources</Text>
            {item.sources.map((source) => (
              <View key={`${source.documentId}#${source.page}`} style={styles.source}>
                <Text style={styles.sourceText} numberOfLines={1}>
                  {source.fileName} · p. {source.page}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <View
      ref={root}
      style={styles.root}
      onLayout={() => root.current?.measureInWindow((_x, y) => setTop(y))}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={top}
        style={styles.page}
      >
        <View style={styles.content}>
          {Platform.OS === "web" && (
            <View style={styles.webHeader}>
              <Link href="/" asChild>
                <Pressable>
                  <Text style={styles.back}>← Home</Text>
                </Pressable>
              </Link>
              <Text style={sharedStyles.title}>Chat</Text>
            </View>
          )}

          <FlatList
            ref={list}
            data={turns}
            extraData={loading}
            keyExtractor={keyExtractor}
            style={styles.turns}
            contentContainerStyle={styles.turnsContent}
            ListEmptyComponent={<Text style={styles.muted}>{emptyLabel}</Text>}
            renderItem={renderTurn}
            // follow the answer as it is written. Waiting a frame lets the new content be laid
            // out first, otherwise the list stops short of its last lines
            onContentSizeChange={() =>
              requestAnimationFrame(() => list.current?.scrollToEnd({ animated: false }))
            }
          />

          {error && <Text style={styles.error}>{error}</Text>}

          {/* the bottom space is on this row, not on the KeyboardAvoidingView: that view sets its
              own paddingBottom for the keyboard and would overwrite it */}
          <View
            style={[
              styles.inputRow,
              { paddingBottom: keyboardOpen ? PAGE_PADDING : Math.max(bottom, PAGE_PADDING) },
            ]}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={submit}
              placeholder="Ask about your documents"
              accessibilityLabel="Question"
              style={styles.input}
              returnKeyType="send"
            />
            <Pressable
              onPress={submit}
              disabled={loading}
              accessibilityLabel="Send"
              style={[sharedStyles.button, loading && styles.disabled]}
            >
              <Text style={sharedStyles.buttonText}>{sendLabel(loading)}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// turns are only ever added at the end, so a position always means the same turn
function keyExtractor(_turn: Turn, index: number) {
  return String(index);
}

const styles = StyleSheet.create({
  answer: { alignSelf: "stretch", gap: 10 },
  back: { color: colors.muted, fontSize: 14 },
  // a readable column, however wide the window is
  content: { flex: 1, maxWidth: 640, width: "100%" },
  disabled: { opacity: 0.5 },
  error: { color: colors.unreachable, paddingVertical: 8 },
  input: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputRow: { flexDirection: "row", gap: 8, paddingTop: 8 },
  muted: { color: colors.muted, fontSize: 13 },
  page: {
    alignItems: "center",
    flex: 1,
    paddingHorizontal: PAGE_PADDING,
    paddingTop: PAGE_PADDING,
  },
  root: { backgroundColor: colors.background, flex: 1, minHeight: "100%" },
  source: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sourceText: { fontSize: 13 },
  sources: { gap: 6 },
  turn: { gap: 12 },
  turns: { flex: 1 },
  turnsContent: { gap: 20, paddingVertical: 16 },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.buttonBackground,
    borderRadius: 12,
    maxWidth: "85%",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  userText: { color: colors.buttonText, fontSize: 16 },
  webHeader: { gap: 16, paddingTop: 8 },
});
