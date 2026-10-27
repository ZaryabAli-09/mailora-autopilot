import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyEmail } from "../src/ai/nemotron.js";

test("Nemotron classification validates JSON and retries an invalid result", async (t) => {
  const previous = {
    fetch: global.fetch,
    key: process.env.NEBIUS_API_KEY,
    base: process.env.NEBIUS_BASE_URL,
    classify: process.env.NEBIUS_MODEL_CLASSIFY,
    fallback: process.env.NEBIUS_MODEL_CLASSIFY_FALLBACK,
  };
  t.after(() => {
    global.fetch = previous.fetch;
    process.env.NEBIUS_API_KEY = previous.key;
    process.env.NEBIUS_BASE_URL = previous.base;
    process.env.NEBIUS_MODEL_CLASSIFY = previous.classify;
    process.env.NEBIUS_MODEL_CLASSIFY_FALLBACK = previous.fallback;
  });
  process.env.NEBIUS_API_KEY = "test-key";
  process.env.NEBIUS_BASE_URL = "https://api.tokenfactory.nebius.com/v1/";
  process.env.NEBIUS_MODEL_CLASSIFY = "test-model";
  delete process.env.NEBIUS_MODEL_CLASSIFY_FALLBACK;
  const requests = [];
  global.fetch = async (_url, init) => {
    requests.push(JSON.parse(init.body));
    return Response.json({ choices: [{ message: { content: JSON.stringify(requests.length === 1
      ? { category: "invented", summary: "Invalid" }
      : { category: "meeting", summary: "A scheduled conversation" }) } }] });
  };
  const result = await classifyEmail({ from: "Person <person@example.com>", subject: "Meet tomorrow", body: "Can we meet tomorrow?" });
  assert.equal(result.category, "meeting");
  assert.equal(result.modelId, "test-model");
  assert.equal(requests.length, 2);
  assert.equal(requests[0].model, "test-model");
  assert.equal(requests[0].response_format.type, "json_object");
});
