import test from "node:test";
import assert from "node:assert/strict";
import {
  PHOTO_BAYS,
  wallBayCenters,
  photoPlacements,
  fitPhotoToMount,
} from "../src/photoLayout.js";
import { galleryDepth } from "../src/galleryLayout.js";

test("every collection size uses whole, centered alcoves without column overlaps", () => {
  for (let count = 6; count <= 45; count++) {
    const depth = galleryDepth(count),
      placements = photoPlacements(count, depth),
      bays = wallBayCenters(depth);
    assert.equal(placements.length, count);
    assert.equal(new Set(placements.map((p) => `${p.x}:${p.z}`)).size, count);
    for (const p of placements.slice(3)) {
      assert.ok(
        bays.includes(p.z),
        `photo ${p.index} in ${count}-photo museum drifted off the grid`,
      );
      const columnIndex = (p.z - PHOTO_BAYS.firstColumn) / PHOTO_BAYS.spacing;
      assert.ok(Math.abs(columnIndex - Math.floor(columnIndex) - 0.5) < 1e-9);
      const freeSpace = PHOTO_BAYS.spacing - 0.94;
      assert.ok(PHOTO_BAYS.frameWidth + 0.3 < freeSpace);
      assert.ok(p.z < depth - 1);
    }
  }
});
test("wide, portrait, square, and panoramic images fit the mount in full", () => {
  for (const [w, h] of [
    [1600, 900],
    [900, 1600],
    [1080, 1080],
    [4000, 500],
    [300, 4000],
  ]) {
    const fit = fitPhotoToMount(w, h, 1.97, 2.27);
    assert.ok(fit.width <= 1.97 + 1e-9 && fit.height <= 2.27 + 1e-9);
    assert.ok(Math.abs(fit.width / fit.height - w / h) < 1e-9);
    assert.ok(
      Math.abs(fit.width - 1.97) < 1e-9 || Math.abs(fit.height - 2.27) < 1e-9,
    );
  }
});
