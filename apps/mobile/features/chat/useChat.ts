import { One } from "one";
import { useEffect, useReducer, useRef } from "react";
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
};

type ChatAction =
  | { type: "asked"; question: string }
  | { type: "answering"; piece: string }
  | { type: "answered"; sources: Source[] }
  | { type: "stopped" }
  | { type: "failed"; error: string }
  | { type: "retried" }
  | { type: "cleared" };

const empty: ChatState = { turns: [], current: null, error: null };

function reducer(state: ChatState, action: ChatAction): ChatState {
  if (action.type === "asked") {
    return {
      ...state,
      error: null,
      current: { question: action.question, answer: "" },
    };
  }
  if (action.type === "cleared") return empty;
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
        error: action.error,
        current: null,
        turns: [...turns, { ...current, failed: true }],
      };
  }
}

export function useChat() {
  const [{ turns, current, error }, dispatch] = useReducer(reducer, empty);
  const conversationId = useRef<string | null>(null);
  // the question being answered: set at once, so a second tap before the next render can't send
  // another, and aborted to stop it, or when the screen closes
  const asking = useRef<AbortController | null>(null);

  useEffect(() => () => asking.current?.abort(), []);

  const send = async (draft: string) => {
    const question = draft.trim();
    if (!question || asking.current) return;

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
  const retry = () => {
    if (!last?.failed || current) return;
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
    error,
    send,
    stop,
    retry,
    startOver,
  };
}

export type ChatViewProps = ReturnType<typeof useChat>;
