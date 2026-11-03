import { useEffect, useReducer, useRef } from "react";
import { askQuestion, createConversation, type Source } from "./api";

export type Turn = {
  question: string;
  answer: string;
  sources?: Source[]; // the pages the answer used, once it is complete
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
  | { type: "failed"; error: string };

function reducer(state: ChatState, action: ChatAction): ChatState {
  if (action.type === "asked") {
    return {
      ...state,
      error: null,
      current: { question: action.question, answer: "" },
    };
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
    case "failed":
      // a failed question stays too, with whatever was written
      return { error: action.error, current: null, turns: [...turns, current] };
  }
}

export function useChat() {
  const [{ turns, current, error }, dispatch] = useReducer(reducer, {
    turns: [],
    current: null,
    error: null,
  });
  const conversationId = useRef<string | null>(null);
  // the question being answered: set at once, so a second tap before the next render can't send
  // another, and stopped when the screen closes
  const asking = useRef<AbortController | null>(null);

  useEffect(() => () => asking.current?.abort(), []);

  const send = async (draft: string) => {
    const question = draft.trim();
    if (!question || asking.current) return;

    const controller = new AbortController();
    asking.current = controller;
    dispatch({ type: "asked", question });
    try {
      // started with the first question, so opening the screen costs nothing
      conversationId.current ??= await createConversation();
      const sources = await askQuestion(
        conversationId.current,
        question,
        (piece) => dispatch({ type: "answering", piece }),
        controller.signal,
      );
      dispatch({ type: "answered", sources });
    } catch (err) {
      if (controller.signal.aborted) return; // the screen was closed
      const error = err instanceof Error ? err.message : "Something went wrong";
      dispatch({ type: "failed", error });
    } finally {
      asking.current = null;
    }
  };

  return {
    turns: current ? [...turns, current] : turns,
    loading: current !== null,
    error,
    send,
  };
}

export type ChatViewProps = ReturnType<typeof useChat>;
