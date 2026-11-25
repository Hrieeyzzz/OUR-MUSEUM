import assert from "node:assert/strict";
import { unlink } from "node:fs/promises";
import { io } from "socket.io-client";
import { launchBrowser } from "./browser.mjs";
const base = "http://localhost:3000";
const browser = await launchBrowser();
const guests = [],
  errors = [];
let id;
async function join(name, color) {
  const socket = io(base, { transports: ["websocket"], reconnection: false });
  guests.push(socket);
  await new Promise((resolve) => socket.on("connect", resolve));
  const result = await socket
    .timeout(5000)
    .emitWithAck("join", { id, name, avatar: { color, hair: "short" } });
  assert.ok(result.id);
  return { socket, ...result };
}
try {
  const page = await browser.newPage({
    viewport: { width: 1100, height: 800 },
    deviceScaleFactor: 0.45,
  });
  page.setDefaultTimeout(60000);
  page.on("pageerror", (e) => errors.push(e.message));
  const created = await page.request.post(base + "/api/museums", {
    data: {
      title: "Our character check",
      photos: Array.from({ length: 6 }, (_, i) => `/photos/0${i + 1}.jpg`),
    },
  });
  ({ id } = await created.json());
  assert.ok(id);
  await page.goto(base + "/?room=" + id);
  await page.getByLabel("Your name", { exact: true }).fill("Alex");
  await page.getByRole("button", { name: "Long hair", exact: true }).click();
  await page.getByRole("button", { name: "Rose outfit", exact: true }).click();
  await page.screenshot({ path: ".arena/character-picker.png" });
  await page.getByRole("button", { name: "Step inside" }).click();
  const scene = page.locator(".museum-canvas");
  await page.waitForFunction(
    () =>
      document.querySelector(".museum-canvas")?.dataset.cameraMode === "first",
  );
  await page
    .getByRole("button", { name: "Show my character", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector(".museum-canvas")?.dataset.localAvatarVisible ===
      "true",
  );
  assert.equal(await scene.getAttribute("data-avatar-count"), "1");
  await page.waitForTimeout(800);
  await page.screenshot({ path: ".arena/character-own.png" });
  const sam = await join("Sam", "#a0ad87");
  const own = sam.people.find((p) => p.name === "Alex");
  assert.equal(own.hair, "long");
  assert.equal(own.color, "#d5a28c");
  await page.waitForFunction(
    () => document.querySelector(".museum-canvas")?.dataset.avatarCount === "2",
  );
  const moves = [];
  sam.socket.on("move", (p) => {
    if (p.id === own.id) moves.push(p);
  });
  await page.keyboard.down("w");
  await page.waitForTimeout(650);
  await page.keyboard.up("w");
  await page.waitForTimeout(250);
  assert.ok(
    moves.some((p) => p.z < 21.8),
    "walking broadcasts the player, not the following camera",
  );
  await page
    .getByRole("button", { name: "Switch to first-person view", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector(".museum-canvas")?.dataset.localAvatarVisible ===
      "false",
  );
  for (const [type, label] of [
    ["hands", "Hold hands"],
    ["kiss", "A little kiss"],
    ["propose", "Ask forever"],
  ]) {
    console.log("Checking gesture:", type);
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.waitForFunction(
      (type) =>
        document.querySelector(".museum-canvas")?.dataset.interaction === type,
      type,
    );
    assert.equal(
      await scene.getAttribute("data-camera-mode"),
      "first",
      "head camera must not switch to an outside angle during a gesture",
    );
    assert.equal(
      await scene.getAttribute("data-local-avatar-visible"),
      "false",
      "own head must stay hidden",
    );
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `.arena/characters-${type}.png` });
    if (type === "propose") {
      assert.equal(
        await page
          .getByRole("button", { name: "A thousand times, yes." })
          .count(),
        0,
        "the proposer should not answer their own question",
      );
      // Disconnecting the partner ends the paired camera and frees movement.
      sam.socket.disconnect();
    }
    await page.waitForFunction(
      () =>
        document.querySelector(".museum-canvas")?.dataset.interaction ===
        "none",
      null,
      { timeout: 18000 },
    );
  }
  await page.waitForFunction(
    () => document.querySelector(".museum-canvas")?.dataset.avatarCount === "1",
  );
  await page
    .getByRole("button", { name: "Show my character", exact: true })
    .click();
  const riya = await join("Riya", "#a4b6c2"),
    noor = await join("Noor", "#c6afd0");
  await page.waitForFunction(
    () => document.querySelector(".museum-canvas")?.dataset.avatarCount === "3",
  );
  await page.getByRole("button", { name: "Hold hands", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Choose your partner", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "R Riya", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector(".museum-canvas")?.dataset.interaction === "hands",
  );
  riya.socket.disconnect();
  noor.socket.disconnect();
  await page.waitForFunction(
    () => document.querySelector(".museum-canvas")?.dataset.avatarCount === "1",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({ path: ".arena/character-mobile.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: visible self, selected appearance, walking, guest avatars, hands, kiss, proposal, head camera preserved through all gestures, partner selection, disconnect cleanup, and mobile character view. No browser errors.",
  );
} finally {
  guests.forEach((s) => s.disconnect());
  await browser.close();
  if (id) await unlink("museum-data/" + id + ".json").catch(() => {});
}
