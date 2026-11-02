// a bad id gets a 400 here, instead of a 500 from Postgres rejecting it as a uuid
export const idParams = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "string", format: "uuid" } },
} as const;
