import { One } from "one";
import { StyleSheet } from "react-native";
import { colors } from "~/features/theme";
import { noChatsLabel, whenLabel } from "./labels";
import type { ConversationsViewProps } from "./types";

// `style` only works on the root view; nested Compose views take composeStyle
export function ConversationsAndroid({
  conversations,
  loaded,
  error,
  remove,
  openChat,
}: ConversationsViewProps) {
  const { Icon, IconButton, LazyColumn, ListItem, Surface, Text } = One.Android;

  return (
    <LazyColumn style={styles.list} contentPadding={listPadding}>
      {error && <Text text={error} composeStyle={composeStyles.error} />}
      {loaded && conversations.length === 0 && (
        <Text text={noChatsLabel} composeStyle={composeStyles.message} />
      )}
      {conversations.map((conversation) => (
        <Surface key={conversation.id} onClick={() => openChat(conversation.id)}>
          <ListItem>
            <ListItem.HeadlineContent>
              <Text text={conversation.title} maxLines={2} />
            </ListItem.HeadlineContent>
            <ListItem.SupportingContent>
              <Text text={whenLabel(conversation.updated_at)} />
            </ListItem.SupportingContent>
            <ListItem.TrailingContent>
              <IconButton onClick={() => remove(conversation)}>
                <Icon name="delete" />
              </IconButton>
            </ListItem.TrailingContent>
          </ListItem>
        </Surface>
      ))}
    </LazyColumn>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
});

const listPadding = { top: 16, bottom: 16 };

const composeStyles = {
  error: { padding: 16, foregroundColor: colors.unreachable },
  message: { padding: 16 },
};
