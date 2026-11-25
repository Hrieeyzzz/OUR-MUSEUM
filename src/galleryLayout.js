// Shared, testable floor plan. The two screens are freestanding, not a wall:
// a 1.5 m centre aisle and wide side aisles connect both photo wings.
export const LOVE_ROTUNDA = Object.freeze({
  x: 0,
  z: 9,
  radius: 6.25,
  benchRadius: 4.65,
  benchWidth: 0.86,
  benchArcs: [
    [0.26, 1.3],
    [1.84, 2.88],
  ],
  screens: [
    { kind: "film", x: -2.6, z: 6.25, width: 3.7, height: 2.28, rotation: 0.1 },
    {
      kind: "question",
      x: 2.6,
      z: 6.25,
      width: 3.7,
      height: 2.28,
      rotation: -0.1,
    },
  ],
  spawn: { x: 0, z: 22 },
  sculptures: [
    { x: -5.35, z: 1.25, kind: "embrace", title: "The embrace" },
    { x: 5.35, z: 1.25, kind: "hearts", title: "Two hearts. One story." },
    { x: -5.35, z: 15.0, kind: "embrace", title: "Always, beside you" },
    { x: 5.35, z: 15.0, kind: "ring", title: "A promise of forever" },
  ],
});
export function galleryDepth(photoCount) {
  return Math.max(32, Math.ceil((photoCount - 3) / 2) * 3.8 + 3);
}
export function rotundaSeat(index = 0) {
  const arc = LOVE_ROTUNDA.benchArcs[index % 2];
  const angle =
    (arc[0] + arc[1]) / 2 +
    (index > 1 ? -0.13 : 0.19) * (index % 2 === 0 ? 1 : -1);
  const x = Math.cos(angle) * LOVE_ROTUNDA.benchRadius;
  const z = LOVE_ROTUNDA.z + Math.sin(angle) * LOVE_ROTUNDA.benchRadius;
  return { x, z, yaw: Math.atan2(x, z - 6.25), pitch: 0.2 };
}
export function constrainLoveWalk(from, next) {
  let { x, z } = next;
  for (const s of LOVE_ROTUNDA.screens) {
    // Slightly padded bounds include the feet and the angled bronze surround.
    if (Math.abs(x - s.x) < s.width / 2 + 0.22 && Math.abs(z - s.z) < 0.52) {
      if (Math.abs(from.x - s.x) >= s.width / 2 + 0.22) x = from.x;
      else z = from.z;
    }
  }
  const dx = x,
    dz = z - LOVE_ROTUNDA.z;
  const radius = Math.hypot(dx, dz),
    angle = Math.atan2(dz, dx);
  if (
    LOVE_ROTUNDA.benchArcs.some(
      ([a, b]) => angle > a - 0.055 && angle < b + 0.055,
    ) &&
    Math.abs(radius - LOVE_ROTUNDA.benchRadius) < 0.7
  ) {
    const oldRadius = Math.hypot(from.x, from.z - LOVE_ROTUNDA.z);
    const boundary =
      LOVE_ROTUNDA.benchRadius +
      (oldRadius > LOVE_ROTUNDA.benchRadius ? 0.71 : -0.71);
    x = (dx / radius) * boundary;
    z = LOVE_ROTUNDA.z + (dz / radius) * boundary;
  }
  for (const s of LOVE_ROTUNDA.sculptures) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < 1.0) {
      const len = Math.max(0.001, d);
      x = s.x + (x - s.x) / len;
      z = s.z + (z - s.z) / len;
    }
  }
  return { x, z };
}
