import { One } from "one";
import { useEffect, useReducer, useRef, useState } from "react";
import { getMessages, type Message } from "~/features/conversations/api";
import { askQuestion, createConversation, type Source } from "./api";

export type Turn = {
  question: string;
  answer: string;
  sources?: Source[]; // the pages the answer used, once it is complete
  stopped?: boolean; // the user stopped the answer before it ended
  failed?: boolean;
};

type ChatState = {
  turns: Turn[];
  current: Turn | null; // the turn being answered, which joins the others when it ends
  error: string | null;
  opening: boolean; // a saved chat's messages haven't loaded yet: still loading, or failed to
};

type ChatAction =
  | { type: "asked"; question: string }
  | { type: "answering"; piece: string }
  | { type: "answered"; sources: Source[] }
  | { type: "stopped" }
  | { type: "failed"; error: string }
  | { type: "retried" }
  | { type: "cleared" }
  | { type: "opened"; turns: Turn[] }
  | { type: "openFailed"; error: string }
  | { type: "reopened" };

const empty: ChatState = { turns: [], current: null, error: null, opening: false };

// A saved chat's messages as turns: each question, with the answer that followed it. A question
// that never got an answer keeps an empty one
export function toTurns(messages: Message[]): Turn[] {
  const turns: Turn[] = [];
  for (const message of messages) {
    const last = turns.at(-1);
    if (message.role === "user") turns.push({ question: message.content, answer: "" });
    else if (last)
      turns[turns.length - 1] = {
        ...last,
        answer: message.content,
        sources: message.sources ?? [],
      };
  }
  return turns;
}

function reducer(state: ChatState, action: ChatAction): ChatState {
  if (action.type === "asked") {
    return {
      ...state,
      error: null,
      current: { question: action.question, answer: "" },
    };
  }
  if (action.type === "cleared") return empty;
  if (action.type === "opened") return { ...empty, turns: action.turns };
  // still opening, so nothing can be sent into a chat the screen doesn't show
  if (action.type === "openFailed") return { ...empty, opening: true, error: action.error };
  if (action.type === "reopened") return { ...state, error: null };
  if (action.type === "retried") {
    // the failed question goes, and is asked again
    return { ...state, error: null, turns: state.turns.slice(0, -1) };
  }
  const { turns, current } = state;
  if (!current) return state;

  switch (action.type) {
    case "answering":
      return {
        ...state,
        current: { ...current, answer: current.answer + action.piece },
      };
    case "answered":
      return {
        ...state,
        current: null,
        turns: [...turns, { ...current, sources: action.sources }],
      };
    case "stopped":
      // what was written so far stays
      return { ...state, current: null, turns: [...turns, { ...current, stopped: true }] };
    case "failed":
      // a failed question stays too, with whatever was written
      return {
        ...state,
        error: action.error,
        current: null,
        turns: [...turns, { ...current, failed: true }],
      };
  }
}

// openId: a saved chat to carry on. Without one, the chat starts empty
export function useChat(openId?: string) {
  const [{ turns, current, error, opening }, dispatch] = useReducer(reducer, {
    ...empty,
    opening: openId !== undefined,
  });
  // each try at loading the saved chat, so Try again can load it again
  const [openAttempt, setOpenAttempt] = useState(0);
  const conversationId = useRef<string | null>(openId ?? null);
  // the question being answered: set at once, so a second tap before the next render can't send
  // another, and aborted to stop it, or when the screen closes
  const asking = useRef<AbortController | null>(null);

  useEffect(() => () => asking.current?.abort(), []);

  useEffect(() => {
    if (!openId) return;
    // still this chat: New chat wasn't tapped while it loaded
    const wanted = () => conversationId.current === openId;
    const open = async () => {
      try {
        const turns = toTurns(await getMessages(openId));
        if (wanted()) dispatch({ type: "opened", turns });
      } catch (err) {
        const error = err instanceof Error ? err.message : "Couldn't open the chat";
        if (wanted()) dispatch({ type: "openFailed", error });
      }
    };
    open();
  }, [openId, openAttempt]);

  const send = async (draft: string) => {
    const question = draft.trim();
    if (!question || asking.current || opening) return;

    const controller = new AbortController();
    asking.current = controller;
    dispatch({ type: "asked", question });
    One.Haptics.impact("light");
    try {
      // started with the first question, so opening the screen costs nothing. Kept only if this
      // question is still wanted: after "new chat" it belongs to the old conversation
      const id = conversationId.current ?? (await createConversation());
      if (!controller.signal.aborted) conversationId.current = id;
      const sources = await askQuestion(
        id,
        question,
        (piece) => dispatch({ type: "answering", piece }),
        controller.signal,
      );
      dispatch({ type: "answered", sources });
      One.Haptics.notification("success");
    } catch (err) {
      // stopped by the user. Started over or closed: nothing is left to update
      if (controller.signal.aborted) {
        if (asking.current === controller) dispatch({ type: "stopped" });
        return;
      }
      const error = err instanceof Error ? err.message : "Something went wrong";
      dispatch({ type: "failed", error });
      One.Haptics.notification("error");
    } finally {
      if (asking.current === controller) asking.current = null;
    }
  };

  const stop = () => asking.current?.abort();

  const last = turns.at(-1);
  // the saved chat that failed to load, or else the question that failed
  const canRetry = opening ? error !== null : Boolean(last?.failed) && !current;
  const retry = () => {
    if (!canRetry) return;
    if (opening) {
      dispatch({ type: "reopened" });
      setOpenAttempt((n) => n + 1);
      return;
    }
    if (!last) return;
    dispatch({ type: "retried" });
    send(last.question);
  };

  // a new conversation: the server keeps the old one, the screen starts empty
  const startOver = () => {
    asking.current?.abort();
    asking.current = null;
    conversationId.current = null;
    dispatch({ type: "cleared" });
  };

  return {
    turns: current ? [...turns, current] : turns,
    loading: current !== null,
    opening,
    error,
    canRetry,
    send,
    stop,
    retry,
    startOver,
  };
}

export type ChatViewProps = ReturnType<typeof useChat>;
