import { Link, One, useSafeAreaInsets } from "one";
import { memo, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  type HostInstance,
  Keyboard,
  KeyboardAvoidingView,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SystemIcon } from "~/features/SystemIcon";
import { colors, sharedStyles } from "~/features/theme";
import { ChatHeader } from "./ChatHeader";
import { Markdown } from "./Markdown";
import type { ChatViewProps, Turn } from "./useChat";

const PAGE_PADDING = 16;
// how close to the end still counts as at the end
const END_MARGIN = 40;
// the space under the message box while the keyboard is open
const KEYBOARD_GAP = 8;
// how long Copy shows it worked
const COPIED_MS = 1500;

const suggestions = [
  "What are these documents about?",
  "Summarize the key numbers",
  "What are the main conclusions?",
];

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

function EmptyState({ onPick }: { onPick: (question: string) => void }) {
  return (
    <View style={styles.empty}>
      <SystemIcon name="text.bubble" fallback="?" size={40} color={colors.accent} />
      <Text style={styles.emptyTitle}>Ask about your documents</Text>
      <Text style={styles.emptyDetail}>
        Answers come from your PDFs and name the pages they used.
      </Text>
      <View style={styles.suggestions}>
        {suggestions.map((question) => (
          <Pressable
            key={question}
            onPress={() => onPick(question)}
            accessibilityRole="button"
            style={({ pressed }) => (pressed ? styles.suggestionPressed : styles.suggestion)}
          >
            <Text style={styles.suggestionText}>{question}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// Copy and Share under a finished answer. Buttons, not a long press: the answer's text is
// selectable, and a long press there selects words
function AnswerActions({ answer }: { answer: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await One.Clipboard.setString(answer);
      One.Haptics.selection();
      setCopied(true);
    } catch {
      // nothing was copied, and the button stays as it was
    }
  };

  const share = async () => {
    try {
      await Share.share({ message: answer });
    } catch {
      // the share sheet couldn't open
    }
  };

  return (
    <View style={styles.actions}>
      <Pressable
        onPress={copy}
        accessibilityRole="button"
        accessibilityLabel="Copy answer"
        hitSlop={8}
      >
        <SystemIcon
          name={copied ? "checkmark" : "doc.on.doc"}
          fallback={copied ? "✓" : "Copy"}
          size={15}
          color={colors.muted}
        />
      </Pressable>
      <Pressable
        onPress={share}
        accessibilityRole="button"
        accessibilityLabel="Share answer"
        hitSlop={8}
      >
        <SystemIcon name="square.and.arrow.up" fallback="Share" size={15} color={colors.muted} />
      </Pressable>
    </View>
  );
}

// memo: a finished turn keeps the same object, so only the turn being answered is drawn again
// with each new piece of text
const TurnRow = memo(function TurnRow({ turn, thinking }: { turn: Turn; thinking: boolean }) {
  const finished = turn.sources !== undefined || turn.stopped;
  return (
    <View style={styles.turn}>
      <View style={styles.userBubble}>
        <Text style={styles.userText} selectable>
          {turn.question}
        </Text>
      </View>
      <View style={styles.answer}>
        {turn.answer ? <Markdown>{turn.answer}</Markdown> : null}
        {thinking ? (
          <View style={styles.thinking}>
            <ActivityIndicator size="small" color={colors.muted} />
            <Text style={styles.muted}>Thinking…</Text>
          </View>
        ) : null}
        {turn.stopped ? <Text style={styles.muted}>Stopped</Text> : null}
        {turn.sources?.length ? (
          <View style={styles.sources}>
            {turn.sources.map((source) => (
              <View key={`${source.documentId}#${source.page}`} style={styles.source}>
                <SystemIcon name="doc.text" fallback="" size={11} color={colors.accent} />
                <Text style={styles.sourceText} numberOfLines={1}>
                  {source.fileName} · p. {source.page}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        {finished && turn.answer ? <AnswerActions answer={turn.answer} /> : null}
      </View>
    </View>
  );
});

// one view for every platform: unlike the documents list, a chat has nothing native to gain
export function ChatView({
  turns,
  loading,
  opening,
  error,
  canRetry,
  send,
  stop,
  retry,
  startOver,
}: ChatViewProps) {
  const [draft, setDraft] = useState("");
  // how far down the window this screen starts (the header), which the keyboard must be offset by
  const [top, setTop] = useState(0);
  const root = useRef<HostInstance>(null);
  const list = useRef<FlatList<Turn>>(null);
  // whether the list is scrolled to the end, so the answer is followed only if the user hasn't
  // scrolled up to read something else
  const atEnd = useRef(true);
  const keyboardOpen = useKeyboardOpen();
  const { bottom } = useSafeAreaInsets();
  const canSend = draft.trim() !== "" && !loading && !opening;

  const ask = (question: string) => {
    atEnd.current = true;
    send(question);
  };

  const submit = () => {
    if (!canSend) return;
    ask(draft);
    setDraft("");
  };

  const onScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
    atEnd.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - END_MARGIN;
  };

  const renderTurn = ({ item, index }: ListRenderItemInfo<Turn>) => (
    <TurnRow turn={item} thinking={!item.answer && loading && index === turns.length - 1} />
  );

  return (
    <View
      ref={root}
      style={styles.root}
      onLayout={() => root.current?.measureInWindow((_x, y) => setTop(y))}
    >
      <ChatHeader canStartOver={turns.length > 0} startOver={startOver} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={top}
        style={styles.page}
      >
        <View style={styles.content}>
          {One.platform === "web" && (
            <View style={styles.webHeader}>
              <Link href="/" asChild>
                <Pressable>
                  <Text style={styles.back}>← Home</Text>
                </Pressable>
              </Link>
              <View style={styles.webTitleRow}>
                <Text style={sharedStyles.title}>Chat</Text>
                {turns.length > 0 && (
                  <Pressable onPress={startOver} accessibilityRole="button">
                    <Text style={styles.link}>New chat</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          <FlatList
            ref={list}
            data={turns}
            extraData={loading}
            keyExtractor={keyExtractor}
            style={styles.turns}
            contentContainerStyle={turns.length ? styles.turnsContent : styles.turnsEmpty}
            ListEmptyComponent={
              // a saved chat that failed to load shows only its error, below
              opening ? (
                error ? undefined : (
                  <ActivityIndicator color={colors.muted} />
                )
              ) : (
                <EmptyState onPick={ask} />
              )
            }
            renderItem={renderTurn}
            onScroll={onScroll}
            scrollEventThrottle={100}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            // follow the answer as it is written. Waiting a frame lets the new content be laid
            // out first, otherwise the list stops short of its last lines
            onContentSizeChange={() => {
              if (!atEnd.current) return;
              requestAnimationFrame(() => list.current?.scrollToEnd({ animated: false }));
            }}
          />

          {error && (
            <View style={styles.errorRow}>
              <Text
                style={styles.error}
                accessibilityRole="alert"
                accessibilityLiveRegion="assertive"
              >
                {error}
              </Text>
              {canRetry && (
                <Pressable onPress={retry} accessibilityRole="button" hitSlop={8}>
                  <Text style={styles.link}>Try again</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* the bottom space is on this row, not on the KeyboardAvoidingView: that view sets its
              own paddingBottom for the keyboard and would overwrite it */}
          <View
            style={[
              styles.composerRow,
              { paddingBottom: keyboardOpen ? KEYBOARD_GAP : Math.max(bottom, PAGE_PADDING) },
            ]}
          >
            <View style={styles.composer}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Ask about your documents"
                placeholderTextColor={colors.muted}
                accessibilityLabel="Question"
                style={styles.input}
                multiline
                // the keyboard's return key sends; a new line isn't needed in a question
                submitBehavior="submit"
                onSubmitEditing={submit}
                returnKeyType="send"
              />
              {loading ? (
                <Pressable
                  onPress={stop}
                  accessibilityLabel="Stop"
                  accessibilityRole="button"
                  style={styles.sendButton}
                >
                  <SystemIcon name="stop.fill" fallback="■" size={12} color={colors.onAccent} />
                </Pressable>
              ) : (
                <Pressable
                  onPress={submit}
                  disabled={!canSend}
                  accessibilityLabel="Send"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canSend }}
                  style={canSend ? styles.sendButton : styles.sendButtonOff}
                >
                  <SystemIcon name="arrow.up" fallback="↑" size={15} color={colors.onAccent} />
                </Pressable>
              )}
            </View>
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

const SEND_SIZE = 32;
const sendButton = {
  alignItems: "center",
  backgroundColor: colors.accent,
  borderRadius: SEND_SIZE / 2,
  height: SEND_SIZE,
  justifyContent: "center",
  width: SEND_SIZE,
} as const;
const suggestion = {
  backgroundColor: colors.fill,
  borderRadius: 18,
  paddingHorizontal: 14,
  paddingVertical: 9,
} as const;

// a Pressable's style must be one object, because an array crashes on web
const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: 18, paddingTop: 2 },
  answer: { alignSelf: "stretch", gap: 10 },
  back: { color: colors.muted, fontSize: 14 },
  composer: {
    alignItems: "flex-end",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 8,
    padding: 6,
    paddingLeft: 14,
  },
  composerRow: { paddingTop: 8 },
  // a readable column, however wide the window is
  content: { flex: 1, maxWidth: 640, width: "100%" },
  empty: { alignItems: "center", gap: 10, paddingHorizontal: 8 },
  emptyDetail: { color: colors.muted, fontSize: 15, textAlign: "center" },
  emptyTitle: { color: colors.text, fontSize: 22, fontWeight: "700", marginTop: 6 },
  error: { color: colors.unreachable, flex: 1 },
  errorRow: { alignItems: "center", flexDirection: "row", gap: 12, paddingVertical: 8 },
  input: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    // about five lines, then it scrolls
    maxHeight: 120,
    paddingBottom: 7,
    paddingTop: 7,
  },
  link: { color: colors.accent, fontSize: 15, fontWeight: "600" },
  muted: { color: colors.muted, fontSize: 13 },
  page: {
    alignItems: "center",
    flex: 1,
    paddingHorizontal: PAGE_PADDING,
    paddingTop: PAGE_PADDING,
  },
  root: { backgroundColor: colors.background, flex: 1, minHeight: "100%" },
  sendButton,
  sendButtonOff: { ...sendButton, opacity: 0.35 },
  source: {
    alignItems: "center",
    backgroundColor: colors.fill,
    borderRadius: 12,
    flexDirection: "row",
    gap: 4,
    maxWidth: "100%",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sourceText: { color: colors.text, flexShrink: 1, fontSize: 13 },
  sources: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  suggestion,
  suggestionPressed: { ...suggestion, opacity: 0.6 },
  suggestionText: { color: colors.text, fontSize: 15 },
  suggestions: { alignItems: "center", gap: 8, marginTop: 14 },
  thinking: { alignItems: "center", flexDirection: "row", gap: 8 },
  turn: { gap: 12 },
  turns: { flex: 1 },
  turnsContent: { gap: 20, paddingVertical: 16 },
  turnsEmpty: { flexGrow: 1, justifyContent: "center", paddingVertical: 16 },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.accent,
    borderRadius: 18,
    maxWidth: "85%",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  userText: { color: colors.onAccent, fontSize: 16 },
  webHeader: { gap: 16, paddingTop: 8 },
  webTitleRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
});
