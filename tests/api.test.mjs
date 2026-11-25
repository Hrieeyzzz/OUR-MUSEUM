import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import { io } from "socket.io-client";

const base = "http://127.0.0.1:3101";
const server = spawn(process.execPath, ["server.js"], {
  env: { ...process.env, PORT: "3101" },
  stdio: ["ignore", "pipe", "pipe"],
});
const ready = new Promise((resolve, reject) => {
  const timeout = setTimeout(
    () => reject(new Error("Test server did not start")),
    20000,
  );
  server.stdout.on("data", (d) => {
    if (String(d).includes("Our Museum is open")) {
      clearTimeout(timeout);
      resolve();
    }
  });
  server.on("error", reject);
});
const clients = [],
  files = [];
function event(s, name, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      s.off(name, listener);
      reject(new Error("Timed out: " + name));
    }, 5000);
    const listener = (d) => {
      if (predicate(d)) {
        clearTimeout(t);
        s.off(name, listener);
        resolve(d);
      }
    };
    s.on(name, listener);
  });
}
async function join(id, name, avatar) {
  const s = io(base, { transports: ["websocket"], reconnection: false });
  clients.push(s);
  await event(s, "connect");
  const result = await s
    .timeout(5000)
    .emitWithAck("join", { id, name, avatar });
  return { s, result };
}

test("Museum API, uploads, and live four-person rooms", async (t) => {
  await ready;
  try {
    await t.test("rejects invalid collections and paths", async () => {
      for (const photos of [
        [],
        ["/photos/01.jpg"],
        Array(6).fill("/../server.js"),
        Array(46).fill("/photos/01.jpg"),
      ]) {
        const r = await fetch(base + "/api/museums", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photos }),
        });
        assert.equal(r.status, 400);
      }
      const unknown = await fetch(base + "/api/not-a-route");
      assert.equal(unknown.status, 404);
      assert.match(unknown.headers.get("content-type"), /application\/json/);
      assert.ok((await unknown.json()).error);
      const notFound = await fetch(base + "/api/museums/not-a-room");
      assert.equal(notFound.status, 404);
    });
    let museum;
    await t.test("uploads photos and persists a museum", async () => {
      const form = new FormData();
      form.append(
        "files",
        new Blob([await readFile("public/photos/01.jpg")], {
          type: "image/jpeg",
        }),
        "my-memory.jpg",
      );
      const upload = await fetch(base + "/api/upload", {
        method: "POST",
        body: form,
      });
      assert.equal(upload.status, 200);
      const { files: uploaded } = await upload.json();
      assert.equal(uploaded.length, 1);
      files.push("museum-data/" + uploaded[0].url.replace(/^\//, ""));
      const photo = await fetch(base + uploaded[0].url);
      assert.equal(photo.status, 200);
      assert.match(photo.headers.get("content-type"), /image\/jpeg/);
      const response = await fetch(base + "/api/museums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Our test museum",
          dedication: "Every ordinary day.",
          question: "Always?",
          photos: [
            uploaded[0].url,
            ...Array.from(
              { length: 5 },
              (_, i) => "/photos/0" + (i + 2) + ".jpg",
            ),
          ],
        }),
      });
      museum = await response.json();
      files.push("museum-data/" + museum.id + ".json");
      assert.equal(response.status, 200);
      assert.equal(museum.photos.length, 6);
      assert.equal(museum.dedication, "Every ordinary day.");
      assert.equal(museum.question, "Always?");
      const get = await (
        await fetch(base + "/api/museums/" + museum.id)
      ).json();
      assert.equal(get.title, museum.title);
      assert.equal(get.id, museum.id);
    });
    await t.test(
      "limits attendance, syncs movement, chat, gestures, and hearts",
      async () => {
        const a = await join(museum.id, "Alex", {
            color: "#a0ad87",
            hair: "long",
          }),
          b = await join(museum.id, "Sam");
        await join(museum.id, "Riya");
        const d = await join(museum.id, "Noor");
        assert.equal(d.result.people.length, 4);
        assert.equal(
          d.result.people.find((p) => p.id === a.result.id).hair,
          "long",
        );
        assert.equal(new Set(d.result.people.map((p) => p.x)).size, 4);
        assert.equal(new Set(d.result.people.map((p) => p.color)).size, 4);
        const fifth = await join(museum.id, "Fifth");
        assert.match(fifth.result.error, /full/);
        const move = event(b.s, "move");
        a.s.emit("move", { x: 3, z: 4, rotation: 0.5 });
        const moved = await move;
        assert.equal(moved.x, 3);
        assert.equal(moved.z, 4);
        const chat = event(b.s, "chat");
        a.s.emit("chat", "Hello, from my device.");
        assert.equal((await chat).text, "Hello, from my device.");
        const gesture = event(b.s, "action");
        a.s.emit("action", { type: "propose", target: b.result.id });
        const proposal = await gesture;
        assert.equal(proposal.type, "propose");
        assert.ok(proposal.placements[a.result.id]);
        assert.equal(proposal.target, b.result.id);
        const hearts = event(a.s, "action", (a) => a.type === "yes");
        b.s.emit("action", { type: "yes" });
        const yes = await hearts;
        assert.equal(yes.type, "yes");
        assert.equal(yes.name, "Sam");
        let leakedMove = false;
        b.s.on("move", () => {
          leakedMove = true;
        });
        a.s.emit("move", { x: 28, z: 99, rotation: 0 });
        const video = event(b.s, "action", (a) => a.type === "video");
        a.s.emit("action", { type: "video", playing: true, time: 12 });
        const play = await video;
        assert.equal(play.time, 12);
        assert.equal(play.playing, true);
        assert.equal(
          leakedMove,
          false,
          "gesture placement must not be overwritten by stale movement",
        );
        const left = event(a.s, "people");
        d.s.disconnect();
        assert.equal((await left).length, 3);
      },
    );
  } finally {
    clients.forEach((c) => c.disconnect());
    server.kill();
    await Promise.all(files.map((f) => unlink(f).catch(() => {})));
  }
});
