import test from "node:test";
import assert from "node:assert/strict";
import {
  museumSpeakerPositions,
  createHallImpulse,
  ROOM_SOUND,
  createMuseumSound,
} from "../src/MuseumSound.js";

test("visible/acoustic speaker pairs cover the entrance, rotunda, and long photo wing", () => {
  for (const depth of [32, 83]) {
    const positions = museumSpeakerPositions(depth);
    assert.equal(positions.length % 2, 0);
    for (let i = 0; i < positions.length; i += 2) {
      assert.equal(positions[i].channel, 0);
      assert.equal(positions[i + 1].channel, 1);
      assert.equal(positions[i].z, positions[i + 1].z);
      assert.equal(positions[i].x, -positions[i + 1].x);
    }
    for (let z = -1; z < depth - 3; z += 2)
      assert.ok(positions.some((p) => Math.abs(p.z - z) <= 7));
  }
  assert.ok(ROOM_SOUND.volume <= 0.4);
  assert.ok(ROOM_SOUND.wet < 0.2);
});
test("hall response is stereo, finite, and decays instead of creating a loud echo", () => {
  const arrays = [];
  const context = {
    sampleRate: 8000,
    createBuffer(channels, length) {
      for (let i = 0; i < channels; i++) arrays.push(new Float32Array(length));
      return { getChannelData: (i) => arrays[i] };
    },
  };
  createHallImpulse(context);
  assert.equal(arrays.length, 2);
  const rms = (array, start, end) =>
    Math.sqrt(
      array.slice(start, end).reduce((s, x) => s + x * x, 0) / (end - start),
    );
  for (const a of arrays) {
    assert.ok(a.every(Number.isFinite));
    assert.ok(rms(a, 200, 1400) > rms(a, 12000, 14000) * 50);
  }
  assert.notDeepEqual(arrays[0].slice(200, 400), arrays[1].slice(200, 400));
});
test("autoplay rejection is handled; a later gesture can start, mute, resume and clean up music", async () => {
  const oldWindow = globalThis.window,
    oldDocument = globalThis.document;
  const elements = [];
  let plays = 0,
    removed = false;
  globalThis.window = {};
  globalThis.document = {
    body: { appendChild: (element) => elements.push(element) },
    createElement: () => ({
      dataset: {},
      addEventListener() {},
      play() {
        plays++;
        return plays === 1
          ? Promise.reject(
              Object.assign(new Error("Gesture required"), {
                name: "NotAllowedError",
              }),
            )
          : Promise.resolve();
      },
      pause() {},
      load() {},
      removeAttribute() {},
      remove() {
        removed = true;
      },
    }),
  };
  let sound;
  try {
    sound = createMuseumSound("/uploads/test.wav", 32);
    assert.equal(elements[0].loop, true);
    assert.equal(await sound.play(), false);
    assert.equal(sound.state, "blocked");
    assert.equal(await sound.play(), true);
    assert.equal(sound.state, "playing");
    sound.setDucked(true);
    assert.ok(elements[0].volume < ROOM_SOUND.volume);
    sound.setDucked(false);
    assert.equal(elements[0].volume, ROOM_SOUND.volume);
    sound.pause();
    assert.equal(sound.state, "muted");
    assert.equal(elements[0].volume, 0);
    assert.equal(await sound.play(), true);
    sound.dispose();
    assert.equal(removed, true);
  } finally {
    sound?.dispose();
    globalThis.window = oldWindow;
    globalThis.document = oldDocument;
  }
});
