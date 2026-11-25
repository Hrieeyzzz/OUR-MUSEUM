import test from "node:test";
import assert from "node:assert/strict";
import {
  LOVE_ROTUNDA,
  galleryDepth,
  rotundaSeat,
  constrainLoveWalk,
} from "../src/galleryLayout.js";

test("love rotunda has two screens and a genuine, walk-through central salon", () => {
  assert.deepEqual(
    LOVE_ROTUNDA.screens.map((s) => s.kind),
    ["film", "question"],
  );
  assert.ok(LOVE_ROTUNDA.radius >= 6);
  assert.ok(galleryDepth(6) >= 32);
  assert.ok(galleryDepth(45) > galleryDepth(6));
  assert.ok(LOVE_ROTUNDA.sculptures.length >= 4);
  assert.deepEqual(
    new Set(LOVE_ROTUNDA.sculptures.map((s) => s.kind)),
    new Set(["embrace", "hearts", "ring"]),
  );
});
test("all four seats are separated and face the two screens", () => {
  const seats = Array.from({ length: 4 }, (_, i) => rotundaSeat(i));
  for (const seat of seats) {
    assert.ok(seat.z > LOVE_ROTUNDA.screens[0].z);
    assert.ok(
      Math.hypot(seat.x, seat.z - LOVE_ROTUNDA.z) < LOVE_ROTUNDA.radius,
    );
    const targetYaw = Math.atan2(seat.x, seat.z - LOVE_ROTUNDA.screens[0].z);
    assert.ok(Math.abs(seat.yaw - targetYaw) < 0.001);
  }
  for (let i = 0; i < seats.length; i++)
    for (let j = i + 1; j < seats.length; j++)
      assert.ok(
        Math.hypot(seats[i].x - seats[j].x, seats[i].z - seats[j].z) > 0.8,
      );
});
test("centre and side aisles reach the photo wing beyond the screens", () => {
  for (const x of [0, -6.9, 6.9]) {
    let current = { x, z: LOVE_ROTUNDA.spawn.z };
    for (let z = current.z - 0.1; z >= -3; z -= 0.1) {
      const next = constrainLoveWalk(current, { x, z });
      assert.ok(
        Math.abs(next.x - x) < 1e-6,
        `aisle x=${x} is blocked at z=${z}`,
      );
      assert.ok(
        Math.abs(next.z - z) < 1e-6,
        `aisle x=${x} is blocked at z=${z}`,
      );
      current = next;
    }
  }
});
test("screen panels and curved seats are solid, without blocking the aisles", () => {
  const screen = LOVE_ROTUNDA.screens[0];
  const from = { x: screen.x, z: screen.z + 0.6 };
  assert.equal(
    constrainLoveWalk(from, { x: screen.x, z: screen.z + 0.45 }).z,
    from.z,
  );
  const seat = rotundaSeat(0),
    theta = Math.atan2(seat.z - LOVE_ROTUNDA.z, seat.x);
  const outer = {
    x: Math.cos(theta) * 5.45,
    z: LOVE_ROTUNDA.z + Math.sin(theta) * 5.45,
  };
  const hit = constrainLoveWalk(outer, seat);
  assert.ok(Math.hypot(hit.x, hit.z - LOVE_ROTUNDA.z) > 5.3);
});
