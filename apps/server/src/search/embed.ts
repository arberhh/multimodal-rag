// a series 3 model: the account's free 200M tokens apply to these
const MODEL = "voyage-3.5";
// small batches keep each request well under Voyage's per-request token limit
const BATCH_SIZE = 16;

type Embedded = { vectors: number[][]; tokens: number };
export type Embed = (texts: string[], inputType: "document" | "query") => Promise<Embedded>;

type VoyageResponse = {
  data: { index: number; embedding: number[] }[];
  usage: { total_tokens: number };
};

// Turns texts into vectors, so texts with a similar meaning end up close together.
export const embedTexts: Embed = async (texts, inputType) => {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error("VOYAGE_API_KEY is not set");

  const batches = Array.from({ length: Math.ceil(texts.length / BATCH_SIZE) }, (_, i) =>
    texts.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE),
  );

  const results = await Promise.all(
    batches.map(async (input) => {
      const res = await fetch("https://api.voyageai.com/v1/embeddings", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ input, model: MODEL, input_type: inputType }),
      });
      if (!res.ok) throw new Error(`Voyage embeddings failed: ${res.status} ${await res.text()}`);

      const body = (await res.json()) as VoyageResponse;
      return {
        vectors: [...body.data].sort((a, b) => a.index - b.index).map((d) => d.embedding),
        tokens: body.usage.total_tokens,
      };
    }),
  );

  return {
    vectors: results.flatMap((r) => r.vectors),
    tokens: results.reduce((n, r) => n + r.tokens, 0),
  };
};
