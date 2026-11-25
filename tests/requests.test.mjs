import test from "node:test";
import assert from "node:assert/strict";
import { requestJson } from "../src/api.js";

test("API requests handle hosting error pages, malformed JSON, empty responses and network failures", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  for (const [status, body] of [
    [503, "The page could not be found"],
    [404, "<!doctype html><h1>Not Found</h1>"],
    [200, "<html>SPA fallback</html>"],
    [200, ""],
    [200, "{bad"],
    [200, "null"],
    [200, "{}"],
  ]) {
    globalThis.fetch = async () => new Response(body, { status });
    await assert.rejects(
      requestJson("/api/museums/abc"),
      (error) =>
        /museum server is unavailable/.test(error.message) &&
        !/Unexpected token|<!doctype/.test(error.message),
    );
  }
  globalThis.fetch = async () => {
    throw new TypeError("Failed to fetch");
  };
  await assert.rejects(requestJson("/api/museums"), /Check your connection/);
  globalThis.fetch = async () =>
    new Response("Request too large", { status: 413 });
  await assert.rejects(
    requestJson("/api/upload", {}, "upload"),
    /upload is too large/,
  );
});

test("API requests preserve JSON errors and validate museum / upload response shapes", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  globalThis.fetch = async () =>
    Response.json(
      { error: "This museum could not be found." },
      { status: 404 },
    );
  await assert.rejects(
    requestJson("/api/museums/missing"),
    /This museum could not be found/,
  );
  const museum = {
    id: "1234567890abcdef",
    title: "Our museum",
    photos: Array(6).fill("/photos/01.jpg"),
  };
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.Accept, "application/json");
    return Response.json(museum);
  };
  assert.deepEqual(await requestJson("/api/museums"), museum);
  globalThis.fetch = async () =>
    Response.json({ files: [{ url: "/uploads/photo.jpg" }] });
  assert.equal(
    (await requestJson("/api/upload", { method: "POST" }, "upload")).files
      .length,
    1,
  );
  globalThis.fetch = async () => Response.json({ files: "not-an-array" });
  await assert.rejects(
    requestJson("/api/upload", {}, "upload"),
    /museum server is unavailable/,
  );
});
