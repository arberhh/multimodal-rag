import { One } from "one";
import { StyleSheet } from "react-native";
import { colors } from "~/features/theme";
import type { Conversation } from "./api";
import { noChatsLabel, whenLabel } from "./labels";
import type { ConversationsViewProps } from "./types";

export function ConversationsIOS({
  conversations,
  loaded,
  error,
  remove,
  openChat,
}: ConversationsViewProps) {
  const { List, Section, Text } = One.iOS;

  return (
    <List listStyle="insetGrouped" style={styles.list}>
      <Section footer={error ?? ""}>
        {loaded && conversations.length === 0 && <Text text={noChatsLabel} />}
        {conversations.map((conversation) => renderConversation(conversation, openChat, remove))}
      </Section>
    </List>
  );
}

function renderConversation(
  conversation: Conversation,
  openChat: ConversationsViewProps["openChat"],
  remove: ConversationsViewProps["remove"],
) {
  const { Button, SwipeActions, Text, VStack } = One.iOS;
  return (
    <SwipeActions key={conversation.id}>
      <Button onPress={() => openChat(conversation.id)}>
        <VStack alignment="leading" spacing={2}>
          <Text text={conversation.title} swiftStyle={swiftStyles.title} />
          <Text text={whenLabel(conversation.updated_at)} swiftStyle={swiftStyles.when} />
        </VStack>
      </Button>
      <SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
        <Button
          label="Remove"
          systemImage="trash"
          buttonRole="destructive"
          onPress={() => remove(conversation)}
        />
      </SwipeActions.Actions>
    </SwipeActions>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
});

const swiftStyles = {
  title: { textStyle: "body", foregroundStyle: colors.text, lineLimitWithOptionalInt: 2 },
  when: { textStyle: "subheadline", foregroundStyle: colors.muted },
} as const;
