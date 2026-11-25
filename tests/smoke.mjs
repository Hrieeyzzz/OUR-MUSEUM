import assert from "node:assert/strict";
import * as THREE from "three";
import { LOVE_ROTUNDA } from "../src/galleryLayout.js";
import { PHOTO_BAYS } from "../src/photoLayout.js";
import { unlink } from "node:fs/promises";
import { launchBrowser } from "./browser.mjs";
const browser = await launchBrowser();
const errors = [];
let museumId, songPath;
function testSong() {
  const rate = 22050,
    samples = rate * 3,
    b = Buffer.alloc(44 + samples * 2);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++)
    b.writeInt16LE(
      Math.round(Math.sin((i / rate) * 2 * Math.PI * 220) * 400),
      44 + i * 2,
    );
  return b;
}
try {
  const page = await browser.newPage({
    viewport: { width: 1100, height: 800 },
    deviceScaleFactor: 0.75,
  });
  page.setDefaultTimeout(60000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/museums/0000000000000000", (route) =>
    route.fulfill({
      status: 503,
      contentType: "text/plain",
      body: "The page could not be found",
    }),
  );
  await page.goto("http://localhost:3000/?room=0000000000000000");
  await page.getByText(/The museum server is unavailable/).waitFor();
  assert.equal(await page.getByText(/Unexpected token/).count(), 0);
  await page.unroute("**/api/museums/0000000000000000");
  await page.goto("http://localhost:3000");
  await page
    .getByRole("button", { name: "Create your museum", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: "Continue", exact: true })
      .isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Try our sample memories" }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Your museum’s name").fill("Our forever collection");
  await page
    .getByLabel("The dedication")
    .fill("For a lifetime of little moments.");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByPlaceholder("Will you keep making memories with me?")
    .fill("Always and forever?");
  await page.locator('input[type="file"][accept^="audio/"]').setInputFiles({
    name: "room-tone.wav",
    mimeType: "audio/wav",
    buffer: testSong(),
  });
  await page
    .getByRole("button", { name: "Open the doors", exact: true })
    .click();
  await page.getByLabel("Your name", { exact: true }).fill("Alex");
  await page.getByRole("button", { name: "Step inside" }).click();
  await page.waitForURL(/room=/);
  museumId = new URL(page.url()).searchParams.get("room");
  const createdMuseum = await (
    await page.request.get("http://localhost:3000/api/museums/" + museumId)
  ).json();
  songPath = "museum-data" + createdMuseum.song;
  await page.getByText("HERE, TOGETHER", { exact: true }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "View the collection" }).count(),
    0,
  );
  // The soundtrack starts at the entrance, without any Sound-on click.
  await page.getByRole("button", { name: "Mute music", exact: true }).waitFor();
  await page.waitForFunction(() => {
    const a = document.querySelector("audio[data-museum-soundtrack]");
    return a && !a.paused && a.currentTime > 0.1;
  });
  assert.equal(
    await page
      .locator("audio[data-museum-soundtrack]")
      .getAttribute("data-room-audio"),
    "spatial",
  );
  assert.equal(
    await page.locator("audio[data-museum-soundtrack]").evaluate((a) => a.loop),
    true,
  );
  await page.getByRole("button", { name: "Mute music", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("audio[data-museum-soundtrack]").paused,
  );
  await page.getByRole("button", { name: "Play music", exact: true }).click();
  await page.getByRole("button", { name: "Mute music", exact: true }).waitFor();
  // The requested default is a head-mounted view, without our own head clipping it.
  await page.waitForFunction(
    () =>
      document.querySelector(".museum-canvas")?.dataset.cameraMode === "first",
  );
  assert.equal(
    await page
      .locator(".museum-canvas")
      .getAttribute("data-local-avatar-visible"),
    "false",
  );
  assert.equal(
    await page.locator(".museum-canvas").getAttribute("data-avatar-count"),
    "1",
  );
  const projectionCamera = new THREE.PerspectiveCamera(
    65,
    1100 / 800,
    0.1,
    130,
  );
  projectionCamera.position.set(0, 1.7, LOVE_ROTUNDA.spawn.z);
  projectionCamera.rotation.set(0.1, 0, 0, "YXZ");
  projectionCamera.updateMatrixWorld();
  const pick = async (x, y, z) => {
    const p = new THREE.Vector3(x, y, z).project(projectionCamera);
    await page
      .locator(".museum-canvas canvas")
      .click({ position: { x: (p.x + 1) * 550, y: (1 - p.y) * 400 } });
  };
  // Pick both independent screens from the real 3D scene.
  await pick(-2.6, 2.78, 6.376);
  await page.getByRole("dialog", { name: "The gallery screens" }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "01 · Our film", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    await page.getByText("Always and forever?", { exact: true }).count(),
    0,
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await pick(2.6, 2.78, 6.376);
  await page.getByText("Always and forever?", { exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "02 · Our question", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  // The new statues are actual pickable exhibits, with museum labels.
  const statue = LOVE_ROTUNDA.sculptures.find((s) => s.x < 0 && s.z > 10);
  await pick(statue.x, 0.65, statue.z + 0.7);
  await page.getByRole("dialog", { name: statue.title, exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Keep wandering", exact: true })
    .click();
  // Inspect the centrepiece through the actual gap between the screens.
  await pick(0, PHOTO_BAYS.centerY, -5.74);
  await page.getByRole("dialog", { name: "Memory 1", exact: true }).waitFor();
  await page.getByRole("button", { name: "Next photo" }).click();
  await page.getByRole("dialog", { name: "Memory 2", exact: true }).waitFor();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Say something" }).click();
  await page.getByLabel("Chat message").fill("Hello, our little world.");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.getByText("Hello, our little world.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Close chat" }).click();
  await page.getByRole("button", { name: "The gallery screens" }).click();
  await page.getByText("Always and forever?", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Yes. Always yes." }).click();
  await page.getByLabel("Hearts falling for everyone in the room").waitFor();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Take a seat", exact: true }).click();
  await page.getByRole("button", { name: "Stand up", exact: true }).waitFor();
  await page.getByRole("button", { name: "Stand up", exact: true }).click();
  await page.getByRole("button", { name: "Invite your people" }).click();
  assert.match(
    await page.getByLabel("Museum invitation link").inputValue(),
    new RegExp(museumId),
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  console.log("Desktop flow passed.");
  await page
    .getByRole("button", { name: "Our Museum home", exact: true })
    .click();
  assert.equal(await page.locator("audio[data-museum-soundtrack]").count(), 0);
  await page.getByRole("button", { name: "My museums" }).click();
  await page.getByRole("button", { name: /Our forever collection/ }).waitFor();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.close();
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  mobile.on("pageerror", (e) => errors.push(e.message));
  await mobile.goto("http://localhost:3000");
  await mobile.waitForTimeout(1200);
  assert.equal(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await mobile.screenshot({ path: ".arena/mobile.png", fullPage: true });
  await mobile
    .getByRole("button", { name: "Create your museum", exact: true })
    .click();
  await mobile.getByRole("button", { name: "Try our sample memories" }).click();
  await mobile.getByRole("button", { name: "Continue", exact: true }).click();
  await mobile.screenshot({ path: ".arena/mobile-builder.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: entrance autoplay, spatial audio graph, mute/resume/cleanup, no side collection button, creation, joining, physical film/question/photo picking, statue inspection, chat, hearts, seating, invitations, saved museums, and mobile layout. No browser errors.",
  );
} finally {
  await browser.close();
  if (songPath) await unlink(songPath).catch(() => {});
  if (museumId)
    await unlink("museum-data/" + museumId + ".json").catch(() => {});
}
