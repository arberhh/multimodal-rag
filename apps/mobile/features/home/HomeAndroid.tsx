import { One } from "one";
import { StyleSheet } from "react-native";
import { colors } from "~/features/theme";
import { whenLabel } from "~/features/conversations/labels";
import { destinations, howItWorks, intro, reachLabel, recentTitle, steps } from "./content";
import type { HomeViewProps } from "./types";

// `style` only works on the root view; nested Compose views take composeStyle
export function HomeAndroid({ status, open, recent, openChat }: HomeViewProps) {
  const { Icon, LazyColumn, ListItem, Surface, Text } = One.Android;
  const ready = status === "connected";

  return (
    <LazyColumn style={styles.list} contentPadding={listPadding}>
      <Text
        text={intro.title}
        fontSize={22}
        fontWeight="semiBold"
        composeStyle={composeStyles.title}
      />
      <Text text={intro.detail} composeStyle={composeStyles.text} />

      {destinations.map((destination) => (
        <Surface key={destination.href} enabled={ready} onClick={() => open(destination.href)}>
          <ListItem>
            <ListItem.LeadingContent>
              <Icon name={destination.icon} />
            </ListItem.LeadingContent>
            <ListItem.HeadlineContent>
              <Text text={destination.title} />
            </ListItem.HeadlineContent>
            <ListItem.SupportingContent>
              <Text text={destination.detail} />
            </ListItem.SupportingContent>
            <ListItem.TrailingContent>
              <Icon name="chevron_right" />
            </ListItem.TrailingContent>
          </ListItem>
        </Surface>
      ))}
      {!ready && <Text text={reachLabel[status]} composeStyle={composeStyles.warning} />}

      {ready && recent.length > 0 && (
        <Text text={recentTitle} fontWeight="semiBold" composeStyle={composeStyles.heading} />
      )}
      {ready &&
        recent.map((conversation) => (
          <Surface key={conversation.id} onClick={() => openChat(conversation.id)}>
            <ListItem>
              <ListItem.HeadlineContent>
                <Text text={conversation.title} maxLines={1} />
              </ListItem.HeadlineContent>
              <ListItem.TrailingContent>
                <Text text={whenLabel(conversation.updated_at)} />
              </ListItem.TrailingContent>
            </ListItem>
          </Surface>
        ))}

      <Text text={howItWorks} fontWeight="semiBold" composeStyle={composeStyles.heading} />
      {steps.map((step) => (
        <ListItem key={step.title}>
          <ListItem.LeadingContent>
            <Icon name={step.icon} />
          </ListItem.LeadingContent>
          <ListItem.HeadlineContent>
            <Text text={step.title} />
          </ListItem.HeadlineContent>
          <ListItem.SupportingContent>
            <Text text={step.detail} />
          </ListItem.SupportingContent>
        </ListItem>
      ))}
    </LazyColumn>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
});

const listPadding = { top: 16, bottom: 16 };

const composeStyles = {
  title: { paddingLeft: 16, paddingRight: 16 },
  text: { padding: 16 },
  heading: { paddingLeft: 16, paddingRight: 16, paddingTop: 24 },
  warning: { padding: 16, foregroundColor: colors.unreachable },
};
