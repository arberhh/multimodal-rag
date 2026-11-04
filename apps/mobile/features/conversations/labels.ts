// when a chat last had a question: the time if it was today, otherwise the date
export function whenLabel(iso: string, now = new Date()) {
  const date = new Date(iso);
  const today = date.toDateString() === now.toDateString();
  return today
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { day: "numeric", month: "short" });
}

export const noChatsLabel = "No chats yet. Ask your first question in Chat.";
