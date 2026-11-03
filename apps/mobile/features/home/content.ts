import type { ServerStatus } from "~/features/server/useServerStatus";

// the words on the home screen, shared by its iOS, Android and web views

export const intro = {
  title: "Chat with your PDFs",
  detail: "Ask questions about your documents and get answers that name the pages they came from.",
};

export const destinations = [
  {
    href: "/chat",
    title: "Chat",
    detail: "Ask a question",
    systemImage: "bubble.left.and.text.bubble.right",
    icon: "forum",
  },
  {
    href: "/conversations",
    title: "All chats",
    detail: "Carry on a past conversation",
    systemImage: "clock.arrow.circlepath",
    icon: "history",
  },
  {
    href: "/documents",
    title: "My Documents",
    detail: "Add and remove PDFs",
    systemImage: "doc.on.doc",
    icon: "description",
  },
] as const;

export const steps = [
  {
    title: "Add your PDFs",
    detail: "Every page is read, with its tables, charts and pictures.",
    systemImage: "doc.badge.plus",
    icon: "upload_file",
  },
  {
    title: "Ask in your own words",
    detail: "The app finds the pages that answer your question.",
    systemImage: "text.magnifyingglass",
    icon: "search",
  },
  {
    title: "Check the sources",
    detail: "Each answer lists the pages it used, so you can see where it came from.",
    systemImage: "checkmark.seal",
    icon: "fact_check",
  },
] as const;

export const howItWorks = "How it works";

// shown under Chat and My Documents, which need the server
export const reachLabel: Record<ServerStatus, string> = {
  checking: "Connecting to the server…",
  connected: "",
  unreachable: "Can't reach the server. Check that it's running, then tap the status to try again.",
};

export const recentTitle = "Recent chats";
export const nameLabel = "Your name";
export const noNameLabel = "Not set";
// how many chats the home screen shows
export const RECENT_CHATS = 5;
