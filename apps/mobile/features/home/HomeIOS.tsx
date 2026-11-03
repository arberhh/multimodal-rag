import { One } from "one";
import { StyleSheet } from "react-native";
import { colors } from "~/features/theme";
import { whenLabel } from "~/features/conversations/labels";
import {
  destinations,
  howItWorks,
  intro,
  nameLabel,
  noNameLabel,
  reachLabel,
  recentTitle,
  steps,
} from "./content";
import type { HomeViewProps } from "./types";

export function HomeIOS({ status, open, recent, openChat, name, rename }: HomeViewProps) {
  const { Button, HStack, Image, LabeledContent, List, Section, Spacer, Text, VStack } = One.iOS;
  const ready = status === "connected";

  return (
    <List listStyle="insetGrouped" style={styles.list}>
      <Section>
        <VStack spacing={8} swiftStyle={swiftStyles.hero}>
          <Image systemName="doc.text.magnifyingglass" swiftStyle={swiftStyles.heroIcon} />
          <Text text={intro.title} swiftStyle={swiftStyles.heroTitle} />
          <Text text={intro.detail} swiftStyle={swiftStyles.heroDetail} />
        </VStack>
      </Section>

      <Section footer={reachLabel[status]}>
        {destinations.map((destination) => (
          <Button
            key={destination.href}
            onPress={() => open(destination.href)}
            swiftStyle={ready ? swiftStyles.enabled : swiftStyles.disabled}
          >
            <HStack spacing={14}>
              <Image systemName={destination.systemImage} swiftStyle={swiftStyles.rowIcon} />
              <VStack alignment="leading" spacing={2}>
                <Text text={destination.title} swiftStyle={swiftStyles.rowTitle} />
                <Text text={destination.detail} swiftStyle={swiftStyles.secondary} />
              </VStack>
              <Spacer />
              <Image systemName="chevron.right" swiftStyle={swiftStyles.chevron} />
            </HStack>
          </Button>
        ))}
      </Section>

      {ready && recent.length > 0 && (
        <Section title={recentTitle}>
          {recent.map((conversation) => (
            <Button key={conversation.id} onPress={() => openChat(conversation.id)}>
              <HStack spacing={10}>
                <Text text={conversation.title} swiftStyle={swiftStyles.chatTitle} />
                <Spacer />
                <Text
                  text={whenLabel(conversation.updated_at)}
                  swiftStyle={swiftStyles.secondary}
                />
              </HStack>
            </Button>
          ))}
        </Section>
      )}

      {ready && rename && (
        <Section>
          <Button onPress={rename}>
            <LabeledContent label={nameLabel} value={name ?? noNameLabel} />
          </Button>
        </Section>
      )}

      <Section title={howItWorks}>
        {steps.map((step) => (
          <HStack key={step.title} alignment="top" spacing={14} swiftStyle={swiftStyles.step}>
            <Image systemName={step.systemImage} swiftStyle={swiftStyles.stepIcon} />
            <VStack alignment="leading" spacing={2}>
              <Text text={step.title} swiftStyle={swiftStyles.rowTitle} />
              <Text text={step.detail} swiftStyle={swiftStyles.secondary} />
            </VStack>
          </HStack>
        ))}
      </Section>
    </List>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
});

// system colors, so the screen follows light and dark mode
const swiftStyles = {
  hero: { maxWidth: Infinity, paddingTop: 8, paddingBottom: 8 },
  heroIcon: { fontSize: 44, foregroundStyle: colors.accent },
  heroTitle: { textStyle: "title2", fontWeight: "bold" },
  heroDetail: {
    textStyle: "subheadline",
    multilineTextAlignmentWithTextAlignment: "center",
    foregroundStyle: colors.muted,
  },
  // the steps read as one list, not rows to tap
  step: {
    listRowSeparator: { visibility: "hidden", edges: "all" },
    paddingTop: 4,
    paddingBottom: 4,
  },
  rowIcon: { fontSize: 22, width: 30, foregroundStyle: colors.accent },
  stepIcon: { fontSize: 20, width: 30, foregroundStyle: colors.muted },
  rowTitle: { textStyle: "body", foregroundStyle: colors.text },
  chatTitle: { textStyle: "body", foregroundStyle: colors.text, lineLimitWithOptionalInt: 1 },
  secondary: { textStyle: "subheadline", foregroundStyle: colors.muted },
  chevron: {
    textStyle: "footnote",
    fontWeight: "semibold",
    foregroundStyle: colors.faint,
  },
  enabled: { disabled: false },
  disabled: { disabled: true, opacity: 0.5 },
} as const;
